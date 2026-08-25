/**
 * Feature 4 row 3 Gate — payroll deduction must stay OFF until 4.7 confirmed.
 *
 * Usage:
 *   npm run test:redo-gate
 */
import {
  REDO_WINDOW_DAYS,
  REDO_PAYROLL_DEDUCTION_ENABLED,
  REDO_DEDUCTION_STAFF_FIELD,
  REDO_COST_BASIS_FIELD,
  REDO_SERVICE_ONLY_ALLOWS_ZERO_COST,
  REDO_ONE_PER_ORIGINAL_LINE,
  getRedoPublicConfig,
  isRedoPayrollDeductionEnabled,
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

console.log("[test] Feature 4 redo gate (row 3)\n");

assertEq(REDO_WINDOW_DAYS, 7, "REDO_WINDOW_DAYS default 7");
assertEq(REDO_PAYROLL_DEDUCTION_ENABLED, false, "payroll deduction GATE is OFF");
assertEq(isRedoPayrollDeductionEnabled(), false, "isRedoPayrollDeductionEnabled() is false");
assertEq(REDO_DEDUCTION_STAFF_FIELD, "redo_staff_id", "4.7a deduct redo_staff_id");
assertEq(REDO_COST_BASIS_FIELD, "purchase_price", "4.7b purchase_price basis");
assert(REDO_SERVICE_ONLY_ALLOWS_ZERO_COST, "4.7d service-only zero cost allowed");
assert(REDO_ONE_PER_ORIGINAL_LINE, "4.7e one redo per line");

const cfg = getRedoPublicConfig();
assertEq(cfg.redo_window_days, 7, "public config exposes window days");
assertEq(cfg.payroll_deduction_enabled, false, "public config shows payroll OFF");

console.log("\n[test] Redo gate passed — do not enable payroll cut until 4.7 sign-off.\n");
