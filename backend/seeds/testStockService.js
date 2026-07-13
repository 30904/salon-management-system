import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/User.js";
import "../models/AuditLog.js";
import ProductMaster from "../models/ProductMaster.js";
import AuditLog from "../models/AuditLog.js";
import { deductStock, addStock } from "../services/stockService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const PRODUCT_SKU = "PROD-STOCK-SVC-TEST-01";

async function runTests() {
  await connectDB();
  console.log("[test] Starting stockService.js tests...\n");

  // Setup: clean + create test product with 10 units
  await ProductMaster.deleteMany({ sku: PRODUCT_SKU });
  const product = await ProductMaster.create({
    name: "Stock Service Test Product",
    sku: PRODUCT_SKU,
    unit: "bottle",
    purchase_price: 100,
    sale_price: 200,
    current_stock: 10,
    reorder_level: 3,
    is_active: true,
  });
  console.log(`[test] Created product: ${product.name} (stock: ${product.current_stock})\n`);

  // 1. Normal deduction — within stock
  console.log("[test] 1. Normal deductStock(qty=3, reason=damage) — should succeed...");
  const r1 = await deductStock(product._id, 3, "damage", { userId: null });
  if (r1.stock_before !== 10 || r1.stock_after !== 7 || r1.deducted !== 3) {
    throw new Error(`Unexpected result: ${JSON.stringify(r1)}`);
  }
  console.log(`       stock_before=${r1.stock_before} -> stock_after=${r1.stock_after} deducted=${r1.deducted}`);
  console.log("       -> PASSED\n");

  // 2. AuditLog check after deduction
  console.log("[test] 2. Verifying AuditLog entry for deduction...");
  const auditDeduct = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: product._id,
    action: "stock_deduct",
  }).sort({ createdAt: -1 });
  if (!auditDeduct) throw new Error("AuditLog entry for stock_deduct not found!");
  if (auditDeduct.details_json.delta !== -3) throw new Error(`Expected delta=-3, got ${auditDeduct.details_json.delta}`);
  if (auditDeduct.details_json.override_used !== false) throw new Error("override_used should be false");
  console.log(`       AuditLog: action=${auditDeduct.action}, delta=${auditDeduct.details_json.delta}, reason=${auditDeduct.details_json.reason}`);
  console.log("       -> PASSED\n");

  // 3. Insufficient stock — no override — should throw 400
  console.log("[test] 3. deductStock(qty=10) with only 7 in stock — should throw 400...");
  let caughtErr = null;
  try {
    await deductStock(product._id, 10, "manual_deduct", { override: false });
  } catch (err) {
    caughtErr = err;
  }
  if (!caughtErr || caughtErr.statusCode !== 400) {
    throw new Error(`Expected 400 error for insufficient stock, got: ${caughtErr?.statusCode}`);
  }
  if (!caughtErr.data?.can_override) {
    throw new Error(`Expected can_override: true in error data, got: ${JSON.stringify(caughtErr.data)}`);
  }
  console.log(`       Got expected 400: "${caughtErr.message}"`);
  console.log(`       can_override hint: ${caughtErr.data.can_override}`);
  console.log("       -> PASSED\n");

  // 4. Override WITHOUT inventory.approve permission — should throw 403
  console.log("[test] 4. force_override=true WITHOUT inventory.approve permission — should throw 403...");
  let caught403 = null;
  try {
    // Pass empty permissions array — no inventory.approve
    await deductStock(product._id, 10, "manual_deduct", {
      override: true,
      permissions: [],  // No permissions at all
    });
  } catch (err) {
    caught403 = err;
  }
  if (!caught403 || caught403.statusCode !== 403) {
    throw new Error(`Expected 403 for missing approve permission, got: ${caught403?.statusCode}`);
  }
  console.log(`       Got expected 403: "${caught403.message}"`);
  console.log("       -> PASSED\n");

  // 5. Override WITH inventory.approve permission — should succeed (floors at 0 if > stock)
  console.log("[test] 5. force_override=true WITH inventory.approve permission — should succeed, stock floors at 0...");
  const approvePermissions = [
    { module: "inventory", action: "view" },
    { module: "inventory", action: "edit" },
    { module: "inventory", action: "approve" },
  ];
  const r5 = await deductStock(product._id, 10, "manual_deduct", {
    override: true,
    permissions: approvePermissions,
    notes: "Manager override test",
  });
  console.log(`       stock_before=${r5.stock_before} -> stock_after=${r5.stock_after} override_used=${r5.override_used}`);
  if (r5.stock_after !== 0) throw new Error(`Expected stock_after=0 (floored), got ${r5.stock_after}`);
  if (!r5.override_used) throw new Error("Expected override_used=true");
  console.log("       -> PASSED\n");

  // 6. AuditLog check for override
  console.log("[test] 6. Verifying AuditLog entry has override_used=true...");
  const auditOverride = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: product._id,
    action: "stock_deduct",
    "details_json.override_used": true,
  }).sort({ createdAt: -1 });
  if (!auditOverride) throw new Error("AuditLog with override_used=true not found!");
  console.log(`       AuditLog: override_used=${auditOverride.details_json.override_used}, notes="${auditOverride.details_json.notes}"`);
  console.log("       -> PASSED\n");

  // 7. addStock (top-up)
  console.log("[test] 7. addStock(qty=15, reason=stock_in) — should restore to 15...");
  const r7 = await addStock(product._id, 15, "stock_in", { notes: "New shipment received" });
  if (r7.stock_before !== 0 || r7.stock_after !== 15 || r7.added !== 15) {
    throw new Error(`Unexpected addStock result: ${JSON.stringify(r7)}`);
  }
  console.log(`       stock_before=${r7.stock_before} -> stock_after=${r7.stock_after} added=${r7.added}`);
  console.log("       -> PASSED\n");

  // 8. AuditLog check for top-up
  console.log("[test] 8. Verifying AuditLog entry for top-up...");
  const auditTopUp = await AuditLog.findOne({
    entity: "ProductMaster",
    entity_id: product._id,
    action: "stock_top_up",
  }).sort({ createdAt: -1 });
  if (!auditTopUp) throw new Error("AuditLog entry for stock_top_up not found!");
  if (auditTopUp.details_json.delta !== 15) throw new Error(`Expected delta=15, got ${auditTopUp.details_json.delta}`);
  console.log(`       AuditLog: action=${auditTopUp.action}, delta=${auditTopUp.details_json.delta}, notes="${auditTopUp.details_json.notes}"`);
  console.log("       -> PASSED\n");

  // Cleanup
  await ProductMaster.deleteMany({ sku: PRODUCT_SKU });
  await AuditLog.deleteMany({ entity: "ProductMaster", entity_id: product._id });
  console.log("[test] Cleaned up test records.");
  console.log("\n[test] All stockService.js tests passed! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test failed:", err.message || err);
  process.exit(1);
});
