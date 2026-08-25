/**
 * Feature 4 tracker row 22 / MD 4.8 — complete redo with 2 products.
 *
 * Approve → complete with 2 products (e.g. 30ml + 15ml):
 * - stock deducted for both
 * - AuditLog reason "redo" for both
 * - ₹0 paid redo invoice
 * - total_product_cost = sum(qty × purchase_price)
 *
 * Usage:
 *   npm run test:redo-complete-products
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import ProductMaster from "../models/ProductMaster.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import CommissionEntry from "../models/CommissionEntry.js";
import AuditLog from "../models/AuditLog.js";
import RedoRequest from "../models/RedoRequest.js";
import {
  createRedoRequest,
  approveRedoRequest,
  completeRedoRequest,
} from "../services/redoService.js";
import { REDO_COST_BASIS_FIELD } from "../constants/redoConstants.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "redo-complete-products-test";
const PHONE = "9100000222";
const SKU_A = "REDO-MD48-A";
const SKU_B = "REDO-MD48-B";
const QTY_A = 30;
const QTY_B = 15;
const PRICE_A = 12.5;
const PRICE_B = 8;

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

function round2(n) {
  return Number(Number(n).toFixed(2));
}

async function cleanup(productIds = []) {
  await RedoRequest.deleteMany({ reason: TAG });

  const customers = await Customer.find({ phone: PHONE }).select("_id");
  const customerIds = customers.map((c) => c._id);
  if (customerIds.length) {
    const invs = await Invoice.find({ customer_id: { $in: customerIds } }).select("_id");
    const invIds = invs.map((i) => i._id);
    if (invIds.length) {
      await InvoiceLineItem.deleteMany({ invoice_id: { $in: invIds } });
      await Invoice.deleteMany({ _id: { $in: invIds } });
    }
    await Customer.deleteMany({ _id: { $in: customerIds } });
  }

  await Invoice.deleteMany({ invoice_number: { $regex: `^${TAG}` } });
  await ProductMaster.deleteMany({ sku: { $in: [SKU_A, SKU_B] } });
  if (productIds.length) {
    await AuditLog.deleteMany({ entity: "ProductMaster", entity_id: { $in: productIds } });
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — complete redo with 2 products (MD 4.8)\n");

  assert(REDO_COST_BASIS_FIELD === "purchase_price", "cost basis is purchase_price");

  await cleanup();

  const requester =
    (await User.findOne({ is_active: true }).select("_id")) ||
    (await User.findOne().select("_id"));
  if (!requester) throw new Error("Need at least one User");

  const staff =
    (await StaffProfile.findOne({ is_active: true }).select("_id")) ||
    (await StaffProfile.findOne().select("_id"));
  if (!staff) throw new Error("Need at least one StaffProfile");

  const customer = await Customer.create({
    name: "Redo Complete Products Customer",
    phone: PHONE,
  });

  const productA = await ProductMaster.create({
    name: "Redo Color Cream A",
    sku: SKU_A,
    unit: "ml",
    purchase_price: PRICE_A,
    sale_price: 99,
    current_stock: 500,
    is_active: true,
  });
  const productB = await ProductMaster.create({
    name: "Redo Developer B",
    sku: SKU_B,
    unit: "ml",
    purchase_price: PRICE_B,
    sale_price: 49,
    current_stock: 400,
    is_active: true,
  });

  const originalInvoice = await Invoice.create({
    invoice_number: `${TAG}-orig-${Date.now()}`,
    customer_id: customer._id,
    customer_name: customer.name,
    customer_phone: PHONE,
    billing_date: new Date(),
    payment_mode: "cash",
    payment_status: "paid",
    totals: {
      subtotal: 1200,
      discount_total: 0,
      tax_total: 0,
      grand_total: 1200,
      amount_paid: 1200,
      amount_due: 0,
    },
  });

  const originalLine = await InvoiceLineItem.create({
    invoice_id: originalInvoice._id,
    item_type: "service",
    item_name: `${TAG} Color Service`,
    quantity: 1,
    unit_price: 1200,
    total_amount: 1200,
    staff_id: staff._id,
  });

  const pending = await createRedoRequest({
    originalLineItemId: originalLine._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  const approved = await approveRedoRequest(pending._id, requester._id);
  assert(approved.status === "approved", "request approved before complete");

  const stockABefore = (await ProductMaster.findById(productA._id)).current_stock;
  const stockBBefore = (await ProductMaster.findById(productB._id)).current_stock;

  const { redoRequest, redoInvoice, redoLine } = await completeRedoRequest(approved._id, {
    productsUsed: [
      { product_id: productA._id, quantity: QTY_A },
      { product_id: productB._id, quantity: QTY_B },
    ],
    userId: requester._id,
  });

  const expectedCost = round2(QTY_A * PRICE_A + QTY_B * PRICE_B);

  assert(redoRequest.status === "completed", "status completed");
  assert(
    Number(redoRequest.total_product_cost) === expectedCost,
    `total_product_cost = ${QTY_A}×${PRICE_A} + ${QTY_B}×${PRICE_B} = ${expectedCost}`
  );
  assert(redoRequest.products_used.length === 2, "products_used has 2 rows");

  const snapA = redoRequest.products_used.find(
    (row) => String(row.product_id) === String(productA._id)
  );
  const snapB = redoRequest.products_used.find(
    (row) => String(row.product_id) === String(productB._id)
  );
  assert(snapA?.quantity === QTY_A, `product A qty snapshot = ${QTY_A}`);
  assert(snapB?.quantity === QTY_B, `product B qty snapshot = ${QTY_B}`);
  assert(
    Number(snapA?.cost_price_snapshot) === PRICE_A,
    "product A cost_price_snapshot = purchase_price"
  );
  assert(
    Number(snapB?.cost_price_snapshot) === PRICE_B,
    "product B cost_price_snapshot = purchase_price"
  );
  assert(
    Number(snapA?.total_cost) === round2(QTY_A * PRICE_A),
    "product A total_cost = qty × purchase_price"
  );
  assert(
    Number(snapB?.total_cost) === round2(QTY_B * PRICE_B),
    "product B total_cost = qty × purchase_price"
  );

  const stockAAfter = (await ProductMaster.findById(productA._id)).current_stock;
  const stockBAfter = (await ProductMaster.findById(productB._id)).current_stock;
  assert(stockAAfter === stockABefore - QTY_A, `product A stock −${QTY_A}`);
  assert(stockBAfter === stockBBefore - QTY_B, `product B stock −${QTY_B}`);

  const auditA = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: productA._id,
    "details_json.reason": "redo",
  }).sort({ createdAt: -1 });
  const auditB = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: productB._id,
    "details_json.reason": "redo",
  }).sort({ createdAt: -1 });
  assert(Boolean(auditA), "AuditLog reason redo for product A");
  assert(Boolean(auditB), "AuditLog reason redo for product B");
  assert(Number(auditA.details_json?.delta) === -QTY_A, `audit A delta −${QTY_A}`);
  assert(Number(auditB.details_json?.delta) === -QTY_B, `audit B delta −${QTY_B}`);

  assert(Number(redoInvoice.totals?.grand_total) === 0, "₹0 redo invoice grand_total");
  assert(Number(redoInvoice.totals?.amount_paid) === 0, "₹0 amount_paid");
  assert(redoInvoice.payment_status === "paid", "redo invoice marked paid");
  assert(Number(redoLine.total_amount) === 0, "₹0 redo service line");
  assert(
    String(redoRequest.redo_invoice_id) === String(redoInvoice._id),
    "request linked to redo invoice"
  );
  assert(
    String(redoLine.redo_request_id) === String(redoRequest._id),
    "redo line linked to request"
  );

  const commissions = await CommissionEntry.countDocuments({
    invoice_line_item_id: redoLine._id,
  });
  assert(commissions === 0, "no CommissionEntry on redo visit");

  await cleanup([productA._id, productB._id]);
  console.log("\n[test] complete redo with 2 products passed");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[test] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
