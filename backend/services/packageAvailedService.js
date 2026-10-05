import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import ServiceMaster from "../models/ServiceMaster.js";

function normName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ratePrice(line, catalog) {
  const unit = Number(line?.unit_price || 0);
  if (unit > 0) return unit;
  if (!line?.item_id) return 0;
  return Number(catalog.get(String(line.item_id)) || 0);
}

/**
 * Attach one dated visit per redemption.
 * Wallet lines are the service itself. Credit lines are the ₹0 package marker,
 * so the covered service name and rate-card price come from the paired bill line.
 */
export async function attachAvailedServices(packages) {
  if (!Array.isArray(packages) || packages.length === 0) return packages;

  const ids = packages.map((pkg) => pkg.id || pkg._id).filter(Boolean);
  for (const pkg of packages) pkg.availed_services = [];
  if (!ids.length) return packages;

  const redemptionLines = await InvoiceLineItem.find({
    package_redemption_id: { $in: ids },
    redo_request_id: null,
  })
    .select(
      "invoice_id item_type item_id item_name unit_price quantity package_redemption_id availed_service_name availed_service_unit_price createdAt"
    )
    .sort({ createdAt: 1 })
    .lean();

  if (!redemptionLines.length) return packages;

  const invoiceIds = [...new Set(redemptionLines.map((line) => String(line.invoice_id)))];
  const invoices = await Invoice.find({
    _id: { $in: invoiceIds },
    payment_status: { $ne: "void" },
  })
    .select("billing_date")
    .lean();
  const invoiceById = new Map(invoices.map((inv) => [String(inv._id), inv]));
  const liveLines = redemptionLines.filter((line) => invoiceById.has(String(line.invoice_id)));
  if (!liveLines.length) return packages;

  const creditLines = liveLines.filter((line) => line.item_type === "package");
  const directLines = liveLines.filter((line) => line.item_type !== "package");
  const creditInvoiceIds = [...new Set(creditLines.map((line) => String(line.invoice_id)))];

  const siblingLines = creditInvoiceIds.length
    ? await InvoiceLineItem.find({
        invoice_id: { $in: creditInvoiceIds },
        item_type: { $in: ["service", "product", "custom"] },
      })
        .select("invoice_id item_id item_name unit_price package_redemption_id createdAt")
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const siblingsByInvoice = new Map();
  for (const line of siblingLines) {
    if (line.package_redemption_id) continue;
    const key = String(line.invoice_id);
    if (!siblingsByInvoice.has(key)) siblingsByInvoice.set(key, []);
    siblingsByInvoice.get(key).push(line);
  }

  const missingPriceIds = new Set();
  for (const line of [...directLines, ...siblingLines]) {
    if (line.item_id && !(Number(line.unit_price) > 0)) missingPriceIds.add(String(line.item_id));
  }
  const catalog = new Map();
  if (missingPriceIds.size) {
    const services = await ServiceMaster.find({ _id: { $in: [...missingPriceIds] } })
      .select("price")
      .lean();
    for (const service of services) catalog.set(String(service._id), Number(service.price || 0));
  }

  const usedSibling = new Set();
  const byPkg = new Map();

  function pushVisit(pkgId, visit) {
    const key = String(pkgId);
    if (!byPkg.has(key)) byPkg.set(key, []);
    byPkg.get(key).push(visit);
  }

  function takeSibling(invoiceId, preferredName, lineCreatedAt) {
    const pool = (siblingsByInvoice.get(String(invoiceId)) || []).filter(
      (sib) => !usedSibling.has(String(sib._id))
    );
    if (!pool.length) return null;
    if (preferredName) {
      const named = pool.find((sib) => normName(sib.item_name) === normName(preferredName));
      if (named) return named;
    }
    const before = pool.filter((sib) => new Date(sib.createdAt) <= new Date(lineCreatedAt));
    return before.length ? before[before.length - 1] : pool[0];
  }

  for (const line of creditLines) {
    const invoice = invoiceById.get(String(line.invoice_id));
    let name = line.availed_service_name ? String(line.availed_service_name).trim() : "";
    let price = Number(line.availed_service_unit_price || 0);
    if (!name || !(price > 0)) {
      const sib = takeSibling(line.invoice_id, name, line.createdAt);
      if (sib) {
        usedSibling.add(String(sib._id));
        if (!name) name = sib.item_name;
        if (!(price > 0)) price = ratePrice(sib, catalog);
      }
    }
    pushVisit(line.package_redemption_id, {
      name: name || line.item_name,
      price,
      date: invoice?.billing_date || line.createdAt,
    });
  }

  for (const line of directLines) {
    const invoice = invoiceById.get(String(line.invoice_id));
    pushVisit(line.package_redemption_id, {
      name: line.item_name,
      price: ratePrice(line, catalog),
      date: invoice?.billing_date || line.createdAt,
    });
  }

  for (const pkg of packages) {
    const rows = byPkg.get(String(pkg.id || pkg._id)) || [];
    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    pkg.availed_services = rows;
  }

  return packages;
}
