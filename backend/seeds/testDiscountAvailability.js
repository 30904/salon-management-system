/**
 * Unit checks for discount day/time windows (no DB).
 *
 * Usage:
 *   node seeds/testDiscountAvailability.js
 */
import {
  isDiscountAvailableAt,
  allocatePercentDiscountToLines,
} from "../constants/discountConstants.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`  PASS: ${label}`);
}

function kolkataInstant({ year, month, day, hour, minute }) {
  const utcMs = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMs);
}

const weekdayLunch = {
  name: "Weekday lunch",
  percent: 10,
  days: [1, 2, 3, 4, 5],
  start_time: "11:00",
  end_time: "15:00",
  is_active: true,
};

console.log("[test] Discount availability\n");

assertEq(
  isDiscountAvailableAt(
    weekdayLunch,
    kolkataInstant({ year: 2026, month: 8, day: 24, hour: 12, minute: 0 })
  ),
  true,
  "Monday 12:00 is inside weekday lunch"
);

assertEq(
  isDiscountAvailableAt(
    weekdayLunch,
    kolkataInstant({ year: 2026, month: 8, day: 24, hour: 16, minute: 0 })
  ),
  false,
  "Monday 16:00 is outside weekday lunch"
);

assertEq(
  isDiscountAvailableAt(
    weekdayLunch,
    kolkataInstant({ year: 2026, month: 8, day: 23, hour: 12, minute: 0 })
  ),
  false,
  "Sunday is not a weekday lunch day"
);

const lines = allocatePercentDiscountToLines(
  [
    { unit_price: 1000, quantity: 1, discount_amount: 0 },
    { unit_price: 0, quantity: 1, discount_amount: 0 },
  ],
  10
);
assertEq(lines[0].discount_amount, 100, "10% of ₹1000 is ₹100");
assertEq(lines[1].discount_amount, 0, "₹0 redemption line stays 0");

console.log("\n[test] Discount availability passed");
