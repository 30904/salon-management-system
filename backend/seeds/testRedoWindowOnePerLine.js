/**
 * Feature 4 tracker row 21 / MD 4.8 — redo window + one-redo-per-line.
 *
 * - 3-day-old service line → create OK
 * - 10-day-old service line → reject (past REDO_WINDOW_DAYS)
 * - Second redo on same line while first is pending/approved → reject
 * - After first is rejected → second create OK
 *
 * Usage:
 *   npm run test:redo-window-one-per-line
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
  rejectRedoRequest,
  approveRedoRequest,
} from "../services/redoService.js";
import { AppError } from "../utils/AppError.js";
import {
  REDO_WINDOW_DAYS,
  REDO_ONE_PER_ORIGINAL_LINE,
} from "../constants/redoConstants.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "redo-window-one-per-line-test";
const PHONE = "9100000211";

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
  await InvoiceLineItem.deleteMany({ item_name: { $regex: `^${TAG}` } });
  await Customer.deleteMany({ phone: PHONE });
}

async function makePaidServiceInvoice({ daysAgo, suffix, customer, staff }) {
  const billingDate = new Date();
  billingDate.setDate(billingDate.getDate() - daysAgo);

  const invoice = await Invoice.create({
    invoice_number: `${TAG}-${suffix}-${Date.now()}`,
    customer_id: customer._id,
    customer_name: customer.name,
    customer_phone: PHONE,
    billing_date: billingDate,
    payment_mode: "cash",
    payment_status: "paid",
    totals: {
      subtotal: 500,
      discount_total: 0,
      tax_total: 0,
      grand_total: 500,
      amount_paid: 500,
      amount_due: 0,
    },
  });

  const line = await InvoiceLineItem.create({
    invoice_id: invoice._id,
    item_type: "service",
    item_name: `${TAG} Haircut ${suffix}`,
    quantity: 1,
    unit_price: 500,
    total_amount: 500,
    staff_id: staff._id,
  });

  return { invoice, line };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — redo window + one-per-line (MD 4.8)\n");

  assert(REDO_WINDOW_DAYS === 7, `REDO_WINDOW_DAYS is 7 (got ${REDO_WINDOW_DAYS})`);
  assert(REDO_ONE_PER_ORIGINAL_LINE === true, "REDO_ONE_PER_ORIGINAL_LINE enabled");

  await cleanup();

  const requester =
    (await User.findOne({ is_active: true }).select("_id")) ||
    (await User.findOne().select("_id"));
  if (!requester) throw new Error("Need at least one User in DB");

  const staff =
    (await StaffProfile.findOne({ is_active: true }).select("_id")) ||
    (await StaffProfile.findOne().select("_id"));
  if (!staff) throw new Error("Need at least one StaffProfile in DB");

  const customer = await Customer.create({
    name: "Redo Window One-Per-Line Customer",
    phone: PHONE,
  });

  // 1) 3-day-old line OK
  const fresh = await makePaidServiceInvoice({
    daysAgo: 3,
    suffix: "d3",
    customer,
    staff,
  });
  const first = await createRedoRequest({
    originalLineItemId: fresh.line._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  assert(first.status === "pending_approval", "3-day-old line → create OK (pending_approval)");

  // 2) Second while first pending → reject
  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: fresh.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "second redo rejected while first is pending_approval"
  );

  // 3) After approve, still one-per-line
  const approved = await approveRedoRequest(first._id, requester._id);
  assert(approved.status === "approved", "first request approved");
  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: fresh.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "second redo rejected while first is approved"
  );

  // 4) Reject path on a different line: after reject, second create OK
  const retryLine = await makePaidServiceInvoice({
    daysAgo: 2,
    suffix: "retry",
    customer,
    staff,
  });
  const pendingThenReject = await createRedoRequest({
    originalLineItemId: retryLine.line._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  const rejected = await rejectRedoRequest(pendingThenReject._id, requester._id);
  assert(rejected.status === "rejected", "first request on retry line rejected");

  const secondAfterReject = await createRedoRequest({
    originalLineItemId: retryLine.line._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  assert(
    secondAfterReject.status === "pending_approval",
    "second redo OK after first was rejected"
  );

  // 5) 10-day-old line reject (past 7-day window)
  const expired = await makePaidServiceInvoice({
    daysAgo: 10,
    suffix: "d10",
    customer,
    staff,
  });
  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: expired.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "10-day-old line rejected (past redo window)"
  );

  await cleanup();
  console.log("\n[test] redo window + one-per-line passed");
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
