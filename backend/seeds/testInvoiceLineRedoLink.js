/**
 * Feature 4 tracker row 6 — InvoiceLineItem.redo_request_id optional ref.
 *
 * Usage:
 *   npm run test:invoice-line-redo-link
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import "../models/RedoRequest.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "redo-line-link-test";

async function cleanup() {
  await InvoiceLineItem.deleteMany({ notes: TAG });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — InvoiceLineItem.redo_request_id\n");

  await cleanup();

  const line = await InvoiceLineItem.create({
    invoice_id: new mongoose.Types.ObjectId(),
    item_type: "service",
    item_name: "Test Redo Link Service",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
    staff_id: new mongoose.Types.ObjectId(),
    notes: TAG,
  });

  if (line.redo_request_id != null) {
    throw new Error("Expected redo_request_id default null");
  }
  const safeBlank = line.toSafeObject();
  if (safeBlank.redo_request_id != null) {
    throw new Error("toSafeObject should expose null redo_request_id by default");
  }
  console.log("  PASS: default redo_request_id is null");

  const redoId = new mongoose.Types.ObjectId();
  line.redo_request_id = redoId;
  await line.save();

  const reloaded = await InvoiceLineItem.findById(line._id);
  if (String(reloaded.redo_request_id) !== String(redoId)) {
    throw new Error("redo_request_id did not persist");
  }
  const safe = reloaded.toSafeObject();
  if (String(safe.redo_request_id) !== String(redoId)) {
    throw new Error("toSafeObject missing redo_request_id");
  }
  console.log("  PASS: redo_request_id persists and appears in toSafeObject");

  const path = InvoiceLineItem.schema.path("redo_request_id");
  if (!path || path.options?.ref !== "RedoRequest") {
    throw new Error('Expected schema ref "RedoRequest"');
  }
  console.log("  PASS: schema ref RedoRequest");

  await cleanup();
  console.log("\n[test] InvoiceLineItem.redo_request_id passed");
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
