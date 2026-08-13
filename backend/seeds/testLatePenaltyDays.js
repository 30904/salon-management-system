/**
 * 3 late marks in a month = 1 unpaid salary day.
 *
 * Usage:
 *   npm run test:late-penalty-days
 */
import {
  LATE_MARKS_PER_UNPAID_DAY,
  unpaidDaysFromLateMarks,
} from "../constants/leaveConstants.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

console.log("[test] Late marks → unpaid salary days\n");

assertEq(LATE_MARKS_PER_UNPAID_DAY, 3, "threshold is 3 late marks");
assertEq(unpaidDaysFromLateMarks(0), 0, "0 late → 0 unpaid");
assertEq(unpaidDaysFromLateMarks(2), 0, "2 late → 0 unpaid");
assertEq(unpaidDaysFromLateMarks(3), 1, "3 late → 1 unpaid");
assertEq(unpaidDaysFromLateMarks(5), 1, "5 late → 1 unpaid");
assertEq(unpaidDaysFromLateMarks(6), 2, "6 late → 2 unpaid");
assertEq(unpaidDaysFromLateMarks(9), 3, "9 late → 3 unpaid");

console.log("\n[test] Late penalty days passed");
