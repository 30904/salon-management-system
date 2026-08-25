/**
 * Feature 4 tracker row 8 — stockService accepts reason "redo" (distinct from damage).
 *
 * Usage:
 *   npm run test:stock-redo-reason
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import ProductMaster from "../models/ProductMaster.js";
import AuditLog from "../models/AuditLog.js";
import { ADJUSTMENT_REASONS, deductStock } from "../services/stockService.js";
import { AppError } from "../utils/AppError.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const SKU = "TEST-REDO-REASON-SKU";

async function cleanup(productId) {
  await ProductMaster.deleteMany({ sku: SKU });
  if (productId) {
    await AuditLog.deleteMany({ entity: "ProductMaster", entity_id: productId });
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — stock redo reason\n");

  await cleanup();

  if (!ADJUSTMENT_REASONS.includes("redo")) {
    throw new Error('ADJUSTMENT_REASONS must include "redo"');
  }
  if (!ADJUSTMENT_REASONS.includes("damage")) {
    throw new Error("damage reason must still exist (distinct from redo)");
  }
  console.log('  PASS: ADJUSTMENT_REASONS includes "redo" (and damage remains)');

  const product = await ProductMaster.create({
    name: "Redo Reason Test Product",
    sku: SKU,
    unit: "ml",
    purchase_price: 10,
    sale_price: 20,
    current_stock: 50,
    low_stock_threshold: 5,
    is_active: true,
  });

  const result = await deductStock(product._id, 2, "redo", {
    notes: "Feature 4 redo product use",
  });
  if (result.stock_before !== 50 || result.stock_after !== 48 || result.deducted !== 2) {
    throw new Error(`Unexpected deductStock result: ${JSON.stringify(result)}`);
  }
  console.log("  PASS: deductStock(..., 'redo') decrements stock");

  const audit = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: product._id,
    action: "stock_deduct",
  }).sort({ createdAt: -1 });

  if (!audit) throw new Error("AuditLog stock_deduct missing");
  if (audit.details_json?.reason !== "redo") {
    throw new Error(`Expected AuditLog reason redo, got ${audit.details_json?.reason}`);
  }
  if (audit.details_json?.reason === "damage") {
    throw new Error("redo must not be logged as damage");
  }
  console.log('  PASS: AuditLog reason is "redo" (not damage)');

  let rejected = false;
  try {
    await deductStock(product._id, 1, "not_a_real_reason");
  } catch (err) {
    rejected = err instanceof AppError && err.statusCode === 400;
  }
  if (!rejected) throw new Error("Invalid reason should still 400");
  console.log("  PASS: invalid reasons still rejected");

  await cleanup(product._id);
  console.log("\n[test] stock redo reason passed");
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
