/**
 * Payroll Stage D test (tracker row 24):
 * deduction = round(perDay * unpaidDays);
 * net = base - deduction + commission_total.
 *
 * Usage:
 *   npm run test:payroll-deduction-net
 */
import {
  calculateDeductionAmount,
  calculateNetPayable,
  calculatePerDayRate,
} from "../services/payrollService.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label} = ${actual}`);
}

async function main() {
  console.log("[test] Formula deduction + net\n");

  // Example: salary 28000, working days 28 → perDay = 1000
  const perDay = calculatePerDayRate(28000, 28);
  assertEq(perDay, 1000, "per_day_rate (28000/28)");

  // deduction = round(1000 * 1.5) = 1500
  const deduction = calculateDeductionAmount(perDay, 1.5);
  assertEq(deduction, 1500, "deduction = round(perDay * unpaidDays)");

  // rounding edge: 1068.9655 * 1 → 1069
  assertEq(
    calculateDeductionAmount(1068.9655, 1),
    1069,
    "deduction rounds to nearest rupee"
  );

  // net = 28000 - 1500 + 2500 = 29000
  const net = calculateNetPayable(28000, 1500, 2500);
  assertEq(net, 29000, "net = base - deduction + commission_total");

  // net with zero commission
  assertEq(calculateNetPayable(28000, 1500, 0), 26500, "net with zero commission");

  // net can reflect commission-only uplift
  assertEq(calculateNetPayable(20000, 0, 3500), 23500, "net with no unpaid days");

  console.log("\n[test] deduction + net formula passed");
}

main().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
