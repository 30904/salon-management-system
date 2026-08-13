/**
 * Unit checks for auto late punch-in (no DB).
 *
 * Usage:
 *   npm run test:punch-late-status
 */
import {
  resolveAutoPunchInStatus,
  DEFAULT_LATE_MARK_MINUTES,
} from "../services/attendancePunchService.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

function kolkataInstant({ year, month, day, hour, minute }) {
  // Build an ISO string that represents that wall clock in Asia/Kolkata (UTC+05:30)
  const utcMs = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMs);
}

console.log("[test] Auto punch-in late status\n");

assertEq(DEFAULT_LATE_MARK_MINUTES, 15, "default late mark is 15 minutes");

// Shift 10:00, grace 15 → late after 10:15
assertEq(
  resolveAutoPunchInStatus({
    punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 10, minute: 15 }),
    shiftStartTime: "10:00",
    lateMarkMinutes: 15,
  }),
  "present",
  "10:15 on 10:00 shift is still present"
);

assertEq(
  resolveAutoPunchInStatus({
    punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 10, minute: 16 }),
    shiftStartTime: "10:00",
    lateMarkMinutes: 15,
  }),
  "late",
  "10:16 on 10:00 shift is late"
);

assertEq(
  resolveAutoPunchInStatus({
    punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 9, minute: 50 }),
    shiftStartTime: "10:00",
    lateMarkMinutes: 15,
  }),
  "present",
  "early punch is present"
);

assertEq(
  resolveAutoPunchInStatus({
    punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 11, minute: 0 }),
    shiftStartTime: null,
    lateMarkMinutes: 15,
  }),
  "present",
  "no shift → present"
);

console.log("\n[test] Auto punch-in late status passed");
