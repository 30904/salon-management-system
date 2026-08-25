/**
 * Punch-in late status + per-staff buffer + branch AttendanceRule fallback.
 *
 * Usage:
 *   npm run test:punch-late-status
 */
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import AttendanceRule from "../models/AttendanceRule.js";
import {
  resolveAutoPunchInStatus,
  resolveLateMarkMinutesForStaff,
  getLateMarkMinutesForBranch,
  DEFAULT_LATE_MARK_MINUTES,
} from "../services/attendancePunchService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TEST_RULE_NAME = "TEST_LATE_BUFFER_BRANCH_RULE";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

function kolkataInstant({ year, month, day, hour, minute }) {
  const utcMs = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMs);
}

async function runUnitChecks() {
  console.log("[test] Auto punch-in late status\n");

  assertEq(DEFAULT_LATE_MARK_MINUTES, 10, "default late mark is 10 minutes");
  assertEq(
    typeof getLateMarkMinutesForBranch,
    "function",
    "getLateMarkMinutesForBranch still exported (not removed)"
  );

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 10, minute: 10 }),
      shiftStartTime: "10:00",
      lateMarkMinutes: 10,
    }),
    "present",
    "10:10 on 10:00 shift is still present"
  );

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 10, minute: 11 }),
      shiftStartTime: "10:00",
      lateMarkMinutes: 10,
    }),
    "late",
    "10:11 on 10:00 shift is late"
  );

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 9, minute: 50 }),
      shiftStartTime: "10:00",
      lateMarkMinutes: 10,
    }),
    "present",
    "early punch is present"
  );

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({ year: 2026, month: 8, day: 13, hour: 11, minute: 0 }),
      shiftStartTime: null,
      lateMarkMinutes: 10,
    }),
    "present",
    "no shift → present"
  );

  console.log("\n[test] Per-staff late buffer (A=5, B=15, C=blank) at shift+7\n");

  const shiftStart = "10:00";
  const punchPlus7 = kolkataInstant({
    year: 2026,
    month: 8,
    day: 13,
    hour: 10,
    minute: 7,
  });

  const minutesA = await resolveLateMarkMinutesForStaff(
    { late_mark_buffer_minutes: 5 },
    null
  );
  assertEq(minutesA, 5, "Staff A personal buffer resolves to 5");
  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: punchPlus7,
      shiftStartTime: shiftStart,
      lateMarkMinutes: minutesA,
    }),
    "late",
    "Staff A (buffer 5) at shift+7 is late"
  );

  const minutesB = await resolveLateMarkMinutesForStaff(
    { late_mark_buffer_minutes: 15 },
    null
  );
  assertEq(minutesB, 15, "Staff B personal buffer resolves to 15");
  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: punchPlus7,
      shiftStartTime: shiftStart,
      lateMarkMinutes: minutesB,
    }),
    "present",
    "Staff B (buffer 15) at shift+7 is present"
  );

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: punchPlus7,
      shiftStartTime: shiftStart,
      lateMarkMinutes: DEFAULT_LATE_MARK_MINUTES,
    }),
    "present",
    "Staff C (blank → default 10) at shift+7 is present"
  );

  console.log("\n[test] Blank vs 0 late buffer distinction\n");

  function formBufferToPayload(value) {
    return value === "" || value === null || value === undefined
      ? null
      : Number(value);
  }
  assertEq(formBufferToPayload(""), null, "empty form field submits null not 0");
  assertEq(formBufferToPayload(undefined), null, "undefined form field submits null");
  assertEq(formBufferToPayload("0"), 0, "explicit 0 form field submits 0");
  assertEq(formBufferToPayload(0), 0, "numeric 0 form field submits 0");

  const minutesZero = await resolveLateMarkMinutesForStaff(
    { late_mark_buffer_minutes: 0 },
    null
  );
  assertEq(minutesZero, 0, "explicit 0 buffer resolves to 0 (not salon default)");

  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({
        year: 2026,
        month: 8,
        day: 13,
        hour: 10,
        minute: 1,
      }),
      shiftStartTime: shiftStart,
      lateMarkMinutes: minutesZero,
    }),
    "late",
    "buffer 0 at shift+1 is late"
  );
  assertEq(
    resolveAutoPunchInStatus({
      punchInDate: kolkataInstant({
        year: 2026,
        month: 8,
        day: 13,
        hour: 10,
        minute: 0,
      }),
      shiftStartTime: shiftStart,
      lateMarkMinutes: minutesZero,
    }),
    "present",
    "buffer 0 at exact shift start is still present"
  );
}

async function runBranchRuleChecks() {
  console.log("\n[test] Branch AttendanceRule still applies (no personal override)\n");

  await connectDB();

  const branchId = new mongoose.Types.ObjectId();

  await AttendanceRule.deleteMany({ name: TEST_RULE_NAME });

  await AttendanceRule.create({
    name: TEST_RULE_NAME,
    late_mark_minutes: 20,
    branch_id: branchId,
    is_active: true,
    leave_types: [],
  });

  try {
    const branchMinutes = await getLateMarkMinutesForBranch(branchId);
    assertEq(branchMinutes, 20, "getLateMarkMinutesForBranch returns branch rule (20)");

    const noOverride = await resolveLateMarkMinutesForStaff(
      { late_mark_buffer_minutes: null },
      branchId
    );
    assertEq(
      noOverride,
      20,
      "staff with null override uses branch AttendanceRule (20)"
    );

    const missingField = await resolveLateMarkMinutesForStaff({}, branchId);
    assertEq(
      missingField,
      20,
      "staff with unset override uses branch AttendanceRule (20)"
    );

    const personalWins = await resolveLateMarkMinutesForStaff(
      { late_mark_buffer_minutes: 5 },
      branchId
    );
    assertEq(personalWins, 5, "personal override still beats branch rule");

    // No matching rule → hardcoded DEFAULT_LATE_MARK_MINUTES
    const orphanBranch = new mongoose.Types.ObjectId();
    const fallback = await getLateMarkMinutesForBranch(orphanBranch);
    // May hit a global active rule if one exists; only assert number + personal path.
    assertEq(
      Number.isFinite(fallback),
      true,
      "orphan branch still resolves a finite late-mark (rule or hardcoded 10)"
    );
  } finally {
    await AttendanceRule.deleteMany({ name: TEST_RULE_NAME });
    await mongoose.connection.close();
  }
}

async function main() {
  await runUnitChecks();
  await runBranchRuleChecks();
  console.log("\n[test] Auto punch-in late status passed");
}

main().catch((err) => {
  console.error("\n[test] FAILED:", err.message || err);
  process.exit(1);
});
