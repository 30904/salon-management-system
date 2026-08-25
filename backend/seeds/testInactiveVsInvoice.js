/**
 * Feature 2 tracker row 33 / MD 2.8 — inactive vs real invoice.
 * - Invoice 10 days ago → not inactive at 60 (even if imported date is old)
 * - Import-only last visit 100 days ago → inactive at 60
 * - No visit date at all → inactive
 *
 * Usage:
 *   npm run test:inactive-vs-invoice
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import { getInactiveCustomers } from "../services/crmAlertService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

const PHONES = {
  recentInvoice: "9900000201",
  importOnly: "9900000202",
  neverVisited: "9900000203",
};

const INVOICE_NUMBER = "INV-INACTIVE-TEST-001";
const THRESHOLD = 60;

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

async function isInactiveAtThreshold(phone, thresholdDays = THRESHOLD) {
  const result = await getInactiveCustomers({
    thresholdDays,
    search: phone,
    pageSize: 50,
  });
  return result.items.some((row) => row.phone === phone);
}

async function findInactiveRow(phone) {
  const result = await getInactiveCustomers({
    thresholdDays: THRESHOLD,
    search: phone,
    pageSize: 50,
  });
  return result.items.find((row) => row.phone === phone) || null;
}

async function cleanup() {
  const invoice = await Invoice.findOne({ invoice_number: INVOICE_NUMBER }).select("_id");
  if (invoice) {
    await Invoice.deleteOne({ _id: invoice._id });
  }
  await Customer.deleteMany({ phone: { $in: Object.values(PHONES) } });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("[test] Inactive vs real invoice (Feature 2 row 33)\n");

  await cleanup();

  const recentInvoiceCustomer = await Customer.create({
    name: "Inactive Test Recent Invoice",
    phone: PHONES.recentInvoice,
    source: "import",
    imported_last_visit_date: daysAgo(200),
  });

  await Customer.create([
    {
      name: "Inactive Test Import Only",
      phone: PHONES.importOnly,
      source: "import",
      imported_last_visit_date: daysAgo(100),
    },
    {
      name: "Inactive Test Never Visited",
      phone: PHONES.neverVisited,
      source: "import",
      imported_last_visit_date: null,
    },
  ]);

  await Invoice.create({
    invoice_number: INVOICE_NUMBER,
    customer_id: recentInvoiceCustomer._id,
    customer_name: recentInvoiceCustomer.name,
    customer_phone: recentInvoiceCustomer.phone,
    billing_date: daysAgo(10),
    totals: {
      subtotal: 500,
      discount_total: 0,
      tax_total: 0,
      grand_total: 500,
      amount_paid: 500,
      amount_due: 0,
    },
    payment_mode: "cash",
    payment_status: "paid",
  });

  const recentInactive = await isInactiveAtThreshold(PHONES.recentInvoice);
  assert(
    recentInactive === false,
    "Customer with invoice 10 days ago is NOT inactive at 60 (imported date ignored)"
  );

  const importOnlyInactive = await isInactiveAtThreshold(PHONES.importOnly);
  assert(
    importOnlyInactive === true,
    "Import-only last visit 100 days ago IS inactive at 60"
  );

  const neverInactive = await isInactiveAtThreshold(PHONES.neverVisited);
  assert(neverInactive === true, "Customer with no visit date IS inactive (never visited)");

  const importRow = await findInactiveRow(PHONES.importOnly);
  assert(
    importRow?.days_since_last_visit >= THRESHOLD,
    `Import-only customer days_since (${importRow?.days_since_last_visit}) >= threshold`
  );

  const neverRow = await findInactiveRow(PHONES.neverVisited);
  assert(
    neverRow?.days_since_last_visit === null,
    "Never-visited customer has null days_since_last_visit"
  );

  console.log(
    JSON.stringify(
      {
        threshold_days: THRESHOLD,
        recent_invoice_inactive: recentInactive,
        import_only_inactive: importOnlyInactive,
        never_visited_inactive: neverInactive,
        import_only_days_since: importRow?.days_since_last_visit,
      },
      null,
      2
    )
  );

  await cleanup();
  await mongoose.disconnect();
  console.log("\n[test] Inactive vs real invoice passed");
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message || err);
  try {
    await cleanup();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
