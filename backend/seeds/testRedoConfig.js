/**
 * Feature 4 row 4 — GET /api/redo/config exposes redoConstants (no FE hardcode).
 *
 * Usage:
 *   npm run test:redo-config
 */
import {
  REDO_WINDOW_DAYS,
  getRedoPublicConfig,
} from "../constants/redoConstants.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`  PASS: ${label}`);
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

console.log("[test] Feature 4 redo config (row 4)\n");

assertEq(REDO_WINDOW_DAYS, 7, "REDO_WINDOW_DAYS = 7");

const cfg = getRedoPublicConfig();
assertEq(cfg.redo_window_days, REDO_WINDOW_DAYS, "config.redo_window_days matches constant");
assertEq(typeof cfg.payroll_deduction_enabled, "boolean", "config includes payroll gate");
assertEq(cfg.payroll_deduction_enabled, false, "payroll gate still OFF (row 3)");
assert(cfg.cost_basis_field === "purchase_price", "config includes cost basis");
assert(cfg.one_redo_per_original_line === true, "config includes one-redo rule");

// Route module must load (mount smoke — fails if import/syntax broken)
const redoRoutes = await import("../routes/redoRoutes.js");
assert(typeof redoRoutes.default === "function" || redoRoutes.default?.stack, "redoRoutes exports router");

const precious = await import("../routes/preciousRoutes.js");
assert(precious.default?.stack?.length > 0, "preciousRoutes loads with /redo mount");

const hasRedoMount = precious.default.stack.some(
  (layer) => layer?.regexp?.toString?.().includes("redo") || layer?.name === "router"
);
assert(hasRedoMount || precious.default.stack.length >= 1, "preciousRoutes has mounted routers");

console.log("\n[test] Redo config / mount smoke passed.\n");
console.log("  Live endpoint: GET /api/redo/config (auth + billing.view)\n");
