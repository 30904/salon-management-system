/**
 * Feature 4 tracker row 11 — completeRedoRequest (stock + ₹0 invoice, no commission).
 *
 * Usage:
 *   npm run test:complete-redo-request
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
import { AppError } from "../utils/AppError.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "complete-redo-test";
const PHONE = "9100000111";
const SKU_A = "REDO-TEST-PROD-A";
const SKU_B = "REDO-TEST-PROD-B";

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

async function expectReject(fn, status, label) {
  try {
    await fn();
    throw new Error(`${label}: expected reject`);
  } catch (err) {
    if (err.message?.includes("expected reject")) throw err;
    assert(err instanceof AppError && err.statusCode === status, label);
  }
}

async function cleanup(productIds = []) {
  await RedoRequest.deleteMany({ reason: TAG });
  await Invoice.deleteMany({
    $or: [
      { invoice_number: { $regex: `^${TAG}` } },
      { invoice_number: { $regex: "^REDO-" }, notes: { $regex: TAG } },
      { notes: { $regex: "Redo — no charge" }, customer_phone: PHONE },
    ],
  });
  // Broad cleanup for redo invoices tied to test customer
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
  await ProductMaster.deleteMany({ sku: { $in: [SKU_A, SKU_B] } });
  if (productIds.length) {
    await AuditLog.deleteMany({ entity: "ProductMaster", entity_id: { $in: productIds } });
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — completeRedoRequest\n");

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
    name: "Complete Redo Customer",
    phone: PHONE,
  });

  const productA = await ProductMaster.create({
    name: "Redo Test Product A",
    sku: SKU_A,
    unit: "ml",
    purchase_price: 40,
    sale_price: 80,
    current_stock: 100,
    is_active: true,
  });
  const productB = await ProductMaster.create({
    name: "Redo Test Product B",
    sku: SKU_B,
    unit: "piece",
    purchase_price: 25,
    sale_price: 50,
    current_stock: 50,
    is_active: true,
  });

  async function seedApproved(suffix) {
    const invoice = await Invoice.create({
      invoice_number: `${TAG}-${suffix}-${Date.now()}`,
      customer_id: customer._id,
      customer_name: customer.name,
      customer_phone: PHONE,
      billing_date: new Date(),
      payment_mode: "cash",
      payment_status: "paid",
      totals: {
        subtotal: 600,
        discount_total: 0,
        tax_total: 0,
        grand_total: 600,
        amount_paid: 600,
        amount_due: 0,
      },
    });

    const line = await InvoiceLineItem.create({
      invoice_id: invoice._id,
      item_type: "service",
      item_name: "Color Service",
      quantity: 1,
      unit_price: 600,
      total_amount: 600,
      staff_id: staff._id,
    });

    const pending = await createRedoRequest({
      originalLineItemId: line._id,
      reason: TAG,
      requestedBy: requester._id,
    });
    const approved = await approveRedoRequest(pending._id, requester._id);
    return { invoice, line, approved };
  }

  // 1) Empty products — still ₹0 invoice, cost 0
  const emptyCase = await seedApproved("empty");
  const emptyResult = await completeRedoRequest(emptyCase.approved._id, {
    productsUsed: [],
    userId: requester._id,
  });
  assert(emptyResult.redoRequest.status === "completed", "empty products → completed");
  assert(emptyResult.redoRequest.total_product_cost === 0, "empty products → cost 0");
  assert(emptyResult.redoInvoice.totals.grand_total === 0, "₹0 invoice grand_total");
  assert(emptyResult.redoInvoice.payment_mode === "other", "payment_mode other");
  assert(emptyResult.redoInvoice.payment_status === "paid", "payment_status paid");
  assert(emptyResult.redoLine.total_amount === 0, "₹0 service line");
  assert(
    String(emptyResult.redoLine.staff_id) === String(staff._id),
    "redo line staff = redo_staff"
  );
  assert(
    String(emptyResult.redoLine.redo_request_id) === String(emptyCase.approved._id),
    "redo line linked to request"
  );

  const commissionsEmpty = await CommissionEntry.countDocuments({
    invoice_line_item_id: emptyResult.redoLine._id,
  });
  assert(commissionsEmpty === 0, "no CommissionEntry for empty-product redo");

  // 2) With products — stock + audit + cost
  const withProducts = await seedApproved("products");
  const stockABefore = (await ProductMaster.findById(productA._id)).current_stock;
  const stockBBefore = (await ProductMaster.findById(productB._id)).current_stock;

  const productResult = await completeRedoRequest(withProducts.approved._id, {
    productsUsed: [
      { product_id: productA._id, quantity: 2 },
      { product_id: productB._id, quantity: 1 },
    ],
    userId: requester._id,
  });

  const expectedCost = 2 * 40 + 1 * 25;
  assert(
    productResult.redoRequest.total_product_cost === expectedCost,
    `total_product_cost = ${expectedCost}`
  );
  assert(
    productResult.redoRequest.products_used.length === 2,
    "products_used has 2 snapshots"
  );

  const stockAAfter = (await ProductMaster.findById(productA._id)).current_stock;
  const stockBAfter = (await ProductMaster.findById(productB._id)).current_stock;
  assert(stockAAfter === stockABefore - 2, "product A stock deducted");
  assert(stockBAfter === stockBBefore - 1, "product B stock deducted");

  const auditRedo = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: productA._id,
    "details_json.reason": "redo",
  }).sort({ createdAt: -1 });
  assert(Boolean(auditRedo), "AuditLog reason redo for product A");

  const commissionsProducts = await CommissionEntry.countDocuments({
    invoice_line_item_id: productResult.redoLine._id,
  });
  assert(commissionsProducts === 0, "no CommissionEntry for product redo");

  // 3) Cannot complete twice
  await expectReject(
    () =>
      completeRedoRequest(withProducts.approved._id, {
        productsUsed: [],
        userId: requester._id,
      }),
    400,
    "cannot complete twice"
  );

  // 4) Pending cannot complete
  const pendingOnly = await seedApproved("pending-only");
  // leave pending — recreate without approve
  await RedoRequest.findByIdAndUpdate(pendingOnly.approved._id, {
    status: "pending_approval",
    approved_by: null,
    approved_at: null,
  });
  await expectReject(
    () =>
      completeRedoRequest(pendingOnly.approved._id, {
        productsUsed: [],
        userId: requester._id,
      }),
    400,
    "pending cannot complete"
  );

  await cleanup([productA._id, productB._id]);
  console.log("\n[test] completeRedoRequest passed");
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
