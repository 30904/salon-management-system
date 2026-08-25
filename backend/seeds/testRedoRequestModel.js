/**
 * Feature 4 tracker row 5 — RedoRequest model fields + status enum.
 *
 * Usage:
 *   npm run test:redo-request-model
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import RedoRequest, { REDO_REQUEST_STATUSES } from "../models/RedoRequest.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "redo-model-test";

async function cleanup() {
  await RedoRequest.deleteMany({ reason: TAG });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — RedoRequest model\n");

  await cleanup();

  const expectedStatuses = [
    "pending_approval",
    "approved",
    "rejected",
    "completed",
  ];
  for (const s of expectedStatuses) {
    if (!REDO_REQUEST_STATUSES.includes(s)) {
      throw new Error(`Missing status ${s} in REDO_REQUEST_STATUSES`);
    }
  }
  console.log("  PASS: status enum pending_approval|approved|rejected|completed");

  const ids = {
    original_invoice_id: new mongoose.Types.ObjectId(),
    original_line_item_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    original_staff_id: new mongoose.Types.ObjectId(),
    redo_staff_id: new mongoose.Types.ObjectId(),
    requested_by: new mongoose.Types.ObjectId(),
  };

  const doc = await RedoRequest.create({
    ...ids,
    reason: TAG,
  });

  if (doc.status !== "pending_approval") {
    throw new Error(`Expected default status pending_approval, got ${doc.status}`);
  }
  if (doc.redo_invoice_id != null) {
    throw new Error("Expected redo_invoice_id default null");
  }
  if (doc.payroll_run_id != null) {
    throw new Error("Expected payroll_run_id default null");
  }
  if (doc.total_product_cost !== 0) {
    throw new Error("Expected total_product_cost default 0");
  }
  if (!Array.isArray(doc.products_used) || doc.products_used.length !== 0) {
    throw new Error("Expected products_used default []");
  }
  console.log("  PASS: create defaults (pending_approval, null invoice/payroll, cost 0)");

  const productId = new mongoose.Types.ObjectId();
  doc.status = "completed";
  doc.products_used = [
    {
      product_id: productId,
      quantity: 2,
      cost_price_snapshot: 50,
      total_cost: 100,
    },
  ];
  doc.total_product_cost = 100;
  doc.redo_invoice_id = new mongoose.Types.ObjectId();
  doc.approved_by = new mongoose.Types.ObjectId();
  doc.approved_at = new Date();
  await doc.save();

  const reloaded = await RedoRequest.findById(doc._id);
  if (reloaded.status !== "completed" || reloaded.total_product_cost !== 100) {
    throw new Error("Expected completed + total_product_cost 100 after save");
  }
  if (reloaded.products_used.length !== 1 || reloaded.products_used[0].total_cost !== 100) {
    throw new Error("products_used snapshot not persisted");
  }
  console.log("  PASS: products_used + total_product_cost + completed persist");

  const safe = reloaded.toSafeObject();
  if (!safe.id || safe.status !== "completed" || safe.total_product_cost !== 100) {
    throw new Error("toSafeObject missing core fields");
  }
  if (!safe.original_invoice_id || !safe.original_line_item_id || !safe.customer_id) {
    throw new Error("toSafeObject missing invoice/line/customer refs");
  }
  if (!safe.original_staff_id || !safe.redo_staff_id || !safe.requested_by) {
    throw new Error("toSafeObject missing staff/requester refs");
  }
  if (!Array.isArray(safe.products_used) || safe.products_used[0].quantity !== 2) {
    throw new Error("toSafeObject products_used mismatch");
  }
  console.log("  PASS: toSafeObject shape");

  await cleanup();
  console.log("\n[test] RedoRequest model passed");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[test] Failed:", error.message);
  try {
    await cleanup();
  } catch {
    // ignore
  }
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
