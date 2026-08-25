/**
 * Feature 4 tracker row 24 / MD 4.8 — reject pending has no side effects.
 *
 * Reject a pending_approval redo →
 * - no redo invoice
 * - no stock change / no AuditLog reason "redo"
 * - no payroll link / no product cost / sumRedo stays 0 for this request
 *
 * Usage:
 *   npm run test:redo-reject-no-side-effects
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
import AuditLog from "../models/AuditLog.js";
import RedoRequest from "../models/RedoRequest.js";
import {
  createRedoRequest,
  rejectRedoRequest,
} from "../services/redoService.js";
import { sumRedoProductCostForStaff } from "../services/payrollService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "redo-reject-no-side-effects-test";
const PHONE = "9100000244";
const SKU = "REDO-REJECT-SIDE-FX";

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

async function cleanup(productId = null) {
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

  await Invoice.deleteMany({
    $or: [
      { invoice_number: { $regex: `^${TAG}` } },
      { invoice_number: { $regex: "^REDO-" }, notes: { $regex: TAG } },
    ],
  });
  await ProductMaster.deleteMany({ sku: SKU });
  if (productId) {
    await AuditLog.deleteMany({ entity: "ProductMaster", entity_id: productId });
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — reject pending has no side effects\n");

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
    name: "Redo Reject Side Effects Customer",
    phone: PHONE,
  });

  const product = await ProductMaster.create({
    name: "Reject Side-Effect Sentinel Product",
    sku: SKU,
    unit: "ml",
    purchase_price: 20,
    sale_price: 40,
    current_stock: 250,
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
      subtotal: 700,
      discount_total: 0,
      tax_total: 0,
      grand_total: 700,
      amount_paid: 700,
      amount_due: 0,
    },
  });

  const originalLine = await InvoiceLineItem.create({
    invoice_id: originalInvoice._id,
    item_type: "service",
    item_name: `${TAG} Service`,
    quantity: 1,
    unit_price: 700,
    total_amount: 700,
    staff_id: staff._id,
  });

  const pending = await createRedoRequest({
    originalLineItemId: originalLine._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  assert(pending.status === "pending_approval", "request starts pending_approval");

  const stockBefore = (await ProductMaster.findById(product._id)).current_stock;
  const invoiceCountBefore = await Invoice.countDocuments({
    customer_id: customer._id,
  });
  const lineCountBefore = await InvoiceLineItem.countDocuments({
    invoice_id: originalInvoice._id,
  });
  const redoInvoiceCountBefore = await Invoice.countDocuments({
    invoice_number: { $regex: "^REDO-" },
    customer_id: customer._id,
  });
  const auditRedoBefore = await AuditLog.countDocuments({
    entity: "ProductMaster",
    entity_id: product._id,
    "details_json.reason": "redo",
  });

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
  const payrollBefore = await sumRedoProductCostForStaff({
    staffId: staff._id,
    payrollRunId: new mongoose.Types.ObjectId(),
    start,
    end,
    enabled: true,
  });

  const rejected = await rejectRedoRequest(pending._id, requester._id);
  assert(rejected.status === "rejected", "pending → rejected");

  assertEq(rejected.redo_invoice_id, null, "reject leaves redo_invoice_id null");
  assertEq(rejected.payroll_run_id, null, "reject leaves payroll_run_id null");
  assertEq(Number(rejected.total_product_cost), 0, "reject leaves total_product_cost 0");
  assertEq(
    (rejected.products_used || []).length,
    0,
    "reject leaves products_used empty"
  );

  const stockAfter = (await ProductMaster.findById(product._id)).current_stock;
  assertEq(stockAfter, stockBefore, "stock unchanged after reject");

  const invoiceCountAfter = await Invoice.countDocuments({
    customer_id: customer._id,
  });
  assertEq(invoiceCountAfter, invoiceCountBefore, "no new invoice for customer");

  const lineCountAfter = await InvoiceLineItem.countDocuments({
    invoice_id: originalInvoice._id,
  });
  assertEq(lineCountAfter, lineCountBefore, "original invoice line count unchanged");

  const redoInvoiceCountAfter = await Invoice.countDocuments({
    invoice_number: { $regex: "^REDO-" },
    customer_id: customer._id,
  });
  assertEq(redoInvoiceCountAfter, redoInvoiceCountBefore, "no REDO- invoice created");

  const auditRedoAfter = await AuditLog.countDocuments({
    entity: "ProductMaster",
    entity_id: product._id,
    "details_json.reason": "redo",
  });
  assertEq(auditRedoAfter, auditRedoBefore, "no AuditLog reason redo written");

  const payrollAfter = await sumRedoProductCostForStaff({
    staffId: staff._id,
    payrollRunId: new mongoose.Types.ObjectId(),
    start,
    end,
    enabled: true,
  });
  assertEq(
    payrollAfter.amount,
    payrollBefore.amount,
    "payroll redo sum unchanged (rejected not included)"
  );
  assert(
    !payrollAfter.redoIds.some((id) => String(id) === String(rejected._id)),
    "rejected request id not claimed by payroll sum"
  );

  const stillRejected = await RedoRequest.findById(rejected._id);
  assert(stillRejected.status === "rejected", "status remains rejected in DB");

  await cleanup(product._id);
  console.log("\n[test] reject pending has no side effects passed");
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
