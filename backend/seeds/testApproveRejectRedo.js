/**
 * Feature 4 tracker row 10 — approve / reject (no invoice/stock/payroll).
 *
 * Usage:
 *   npm run test:approve-reject-redo
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import RedoRequest from "../models/RedoRequest.js";
import {
  createRedoRequest,
  approveRedoRequest,
  rejectRedoRequest,
} from "../services/redoService.js";
import { AppError } from "../utils/AppError.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "approve-reject-redo-test";
const PHONE = "9100000100";

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

async function cleanup() {
  await RedoRequest.deleteMany({ reason: TAG });
  await Invoice.deleteMany({ invoice_number: { $regex: `^${TAG}` } });
  await Customer.deleteMany({ phone: PHONE });
}

async function makePending({ requesterId, staffId, customerId, suffix }) {
  const invoice = await Invoice.create({
    invoice_number: `${TAG}-${suffix}-${Date.now()}`,
    customer_id: customerId,
    customer_name: "Approve Reject Test",
    billing_date: new Date(),
    payment_mode: "cash",
    payment_status: "paid",
    totals: {
      subtotal: 400,
      discount_total: 0,
      tax_total: 0,
      grand_total: 400,
      amount_paid: 400,
      amount_due: 0,
    },
  });

  const line = await InvoiceLineItem.create({
    invoice_id: invoice._id,
    item_type: "service",
    item_name: "Approve Reject Service",
    quantity: 1,
    unit_price: 400,
    total_amount: 400,
    staff_id: staffId,
  });

  const doc = await createRedoRequest({
    originalLineItemId: line._id,
    reason: TAG,
    requestedBy: requesterId,
  });

  return { invoice, line, doc };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — approve / reject redo\n");

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
    name: "Approve Reject Redo Customer",
    phone: PHONE,
  });

  // Approve path
  const toApprove = await makePending({
    requesterId: requester._id,
    staffId: staff._id,
    customerId: customer._id,
    suffix: "approve",
  });

  const approved = await approveRedoRequest(toApprove.doc._id, requester._id);
  assert(approved.status === "approved", "pending → approved");
  assert(String(approved.approved_by) === String(requester._id), "approved_by set");
  assert(approved.approved_at != null, "approved_at set");
  assert(approved.redo_invoice_id == null, "approve creates no invoice");
  assert(approved.total_product_cost === 0, "approve creates no product cost");
  assert(approved.payroll_run_id == null, "approve creates no payroll link");

  await expectReject(
    () => approveRedoRequest(toApprove.doc._id, requester._id),
    400,
    "cannot approve twice"
  );

  // Reject path + re-request allowed
  const toReject = await makePending({
    requesterId: requester._id,
    staffId: staff._id,
    customerId: customer._id,
    suffix: "reject",
  });

  const invoiceCountBefore = await Invoice.countDocuments({
    invoice_number: { $regex: `^${TAG}` },
  });
  const rejected = await rejectRedoRequest(toReject.doc._id, requester._id);
  assert(rejected.status === "rejected", "pending → rejected");

  const invoiceCountAfter = await Invoice.countDocuments({
    invoice_number: { $regex: `^${TAG}` },
  });
  assert(
    invoiceCountAfter === invoiceCountBefore,
    "reject creates no new invoice"
  );
  assert(rejected.redo_invoice_id == null, "reject leaves redo_invoice_id null");
  assert(rejected.payroll_run_id == null, "reject leaves payroll_run_id null");

  const reRequest = await createRedoRequest({
    originalLineItemId: toReject.line._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  assert(
    reRequest.status === "pending_approval",
    "after reject, new redo on same line allowed"
  );

  await cleanup();
  console.log("\n[test] approve / reject redo passed");
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
