/**
 * Feature 4 tracker row 9 — createRedoRequest rules.
 *
 * Usage:
 *   npm run test:create-redo-request
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
import { createRedoRequest } from "../services/redoService.js";
import { AppError } from "../utils/AppError.js";
import { REDO_WINDOW_DAYS } from "../constants/redoConstants.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "create-redo-request-test";
const PHONE = "9100000099";

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

async function cleanup(ids) {
  if (ids?.redoIds?.length) await RedoRequest.deleteMany({ _id: { $in: ids.redoIds } });
  if (ids?.lineIds?.length) await InvoiceLineItem.deleteMany({ _id: { $in: ids.lineIds } });
  if (ids?.invoiceIds?.length) await Invoice.deleteMany({ _id: { $in: ids.invoiceIds } });
  await RedoRequest.deleteMany({ reason: TAG });
  await Invoice.deleteMany({ invoice_number: { $regex: `^${TAG}` } });
  await Customer.deleteMany({ phone: PHONE });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — createRedoRequest\n");

  const ids = { redoIds: [], lineIds: [], invoiceIds: [] };
  await cleanup(ids);

  const requester =
    (await User.findOne({ is_active: true }).select("_id")) ||
    (await User.findOne().select("_id"));
  if (!requester) throw new Error("Need at least one User in DB");

  const staff =
    (await StaffProfile.findOne({ is_active: true }).select("_id")) ||
    (await StaffProfile.findOne().select("_id"));
  if (!staff) throw new Error("Need at least one StaffProfile in DB");

  const customer = await Customer.create({
    name: "Redo Create Test Customer",
    phone: PHONE,
  });

  async function makeInvoice({ daysAgo, itemType = "service", numberSuffix }) {
    const billingDate = new Date();
    billingDate.setDate(billingDate.getDate() - daysAgo);

    const invoice = await Invoice.create({
      invoice_number: `${TAG}-${numberSuffix}-${Date.now()}`,
      customer_id: customer._id,
      customer_name: customer.name,
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
    ids.invoiceIds.push(invoice._id);

    const line = await InvoiceLineItem.create({
      invoice_id: invoice._id,
      item_type: itemType,
      item_name: itemType === "service" ? "Haircut Redo Test" : "Shampoo Product",
      quantity: 1,
      unit_price: 500,
      total_amount: 500,
      staff_id: staff._id,
    });
    ids.lineIds.push(line._id);
    return { invoice, line };
  }

  const fresh = await makeInvoice({ daysAgo: 3, numberSuffix: "fresh" });
  const created = await createRedoRequest({
    originalLineItemId: fresh.line._id,
    reason: TAG,
    requestedBy: requester._id,
  });
  ids.redoIds.push(created._id);

  assert(created.status === "pending_approval", "status is pending_approval");
  assert(String(created.original_staff_id) === String(staff._id), "original_staff from line");
  assert(String(created.redo_staff_id) === String(staff._id), "redo_staff defaults to original");
  assert(String(created.customer_id) === String(customer._id), "customer from invoice");
  assert(created.redo_invoice_id == null, "no redo invoice yet");
  assert(created.total_product_cost === 0, "no product cost yet");
  assert(created.payroll_run_id == null, "no payroll link yet");
  console.log(`  (window constant REDO_WINDOW_DAYS=${REDO_WINDOW_DAYS})`);

  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: fresh.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "second non-rejected redo on same line rejected"
  );

  const productLine = await makeInvoice({
    daysAgo: 1,
    itemType: "product",
    numberSuffix: "product",
  });
  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: productLine.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "product line rejected (service only)"
  );

  const expired = await makeInvoice({ daysAgo: 10, numberSuffix: "old" });
  await expectReject(
    () =>
      createRedoRequest({
        originalLineItemId: expired.line._id,
        reason: TAG,
        requestedBy: requester._id,
      }),
    400,
    "10-day-old line rejected (window)"
  );

  await cleanup(ids);
  console.log("\n[test] createRedoRequest passed");
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
