/**
 * Payroll Stage B test (tracker row 16):
 * Hand-count one employee one month — seed holiday + paid leave +
 * unpaid leave + presents; verify every returned field by hand.
 *
 * August 2026 fixture (hand-calc):
 *   holidays: 2 (Aug 15, Aug 20)
 *   present: 2 (Aug 17, Aug 18)
 *   late: 1 (Aug 19)
 *   half_day: 1 (Aug 24)
 *   paid leave: 1 (Aug 11)
 *   unpaid leave: 1 (Aug 12)
 *   absent: 1 (Aug 13)
 *   present-on-holiday (Aug 15) — skipped, does not affect counts
 *
 *   holiday_count          = 2
 *   working_days_in_month  = 31 - 2 = 29
 *   days_present           = 2
 *   days_late              = 1
 *   days_half_day          = 1
 *   days_paid_leave        = 1
 *   days_unpaid_leave      = 1
 *   days_on_leave          = 2
 *   days_absent            = 1
 *   payable_days           = 2 + 1 + 0.5 + 1 + 2 = 6.5
 *   unpaid_days            = 1 + 1 = 2
 *
 * Usage:
 *   npm run test:attendance-summary-hand-count
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/ShiftMaster.js";
import "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import Holiday from "../models/Holiday.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001616";
const YEAR = 2026;
const MONTH = 8;

const EXPECTED = {
  total_days_in_month: 31,
  holiday_count: 2,
  working_days_in_month: 29,
  days_present: 2,
  days_late: 1,
  days_half_day: 1,
  days_paid_leave: 1,
  days_unpaid_leave: 1,
  days_on_leave: 2,
  days_absent: 1,
  payable_days: 6.5,
  unpaid_days: 2,
};

async function cleanup() {
  await Holiday.deleteMany({ name: { $regex: /^Hand Count Holiday/ } });

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await LeaveRequest.deleteMany({ staff_id: profile._id });
    await Attendance.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label} = ${actual}`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — hand-count one employee August 2026\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Hand Count Summary Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@hand-count-summary.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    base_salary: 25000,
    is_active: true,
  });

  await Holiday.create([
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 15)),
      name: "Hand Count Holiday A",
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 20)),
      name: "Hand Count Holiday B",
      branch_id: null,
      is_active: true,
    },
  ]);

  const paidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: new Date(Date.UTC(YEAR, MONTH - 1, 11)),
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Hand-count paid leave",
  });
  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: new Date(Date.UTC(YEAR, MONTH - 1, 12)),
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
    reason: "Hand-count unpaid leave",
  });

  await Attendance.create([
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 11)),
      status: "on_leave",
      leave_request_id: paidLeave._id,
      remarks: "Paid leave",
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 12)),
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
      remarks: "Unpaid leave",
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 13)),
      status: "absent",
    },
    // Present punched on holiday — must be skipped by holiday-aware loop
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 15)),
      status: "present",
      punch_in_time: new Date(Date.UTC(YEAR, MONTH - 1, 15, 9, 0)),
      punch_out_time: new Date(Date.UTC(YEAR, MONTH - 1, 15, 18, 0)),
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 17)),
      status: "present",
      punch_in_time: new Date(Date.UTC(YEAR, MONTH - 1, 17, 9, 0)),
      punch_out_time: new Date(Date.UTC(YEAR, MONTH - 1, 17, 18, 0)),
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 18)),
      status: "present",
      punch_in_time: new Date(Date.UTC(YEAR, MONTH - 1, 18, 9, 0)),
      punch_out_time: new Date(Date.UTC(YEAR, MONTH - 1, 18, 18, 0)),
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 19)),
      status: "late",
      punch_in_time: new Date(Date.UTC(YEAR, MONTH - 1, 19, 10, 30)),
      punch_out_time: new Date(Date.UTC(YEAR, MONTH - 1, 19, 18, 0)),
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 24)),
      status: "half_day",
      punch_in_time: new Date(Date.UTC(YEAR, MONTH - 1, 24, 9, 0)),
      punch_out_time: new Date(Date.UTC(YEAR, MONTH - 1, 24, 13, 0)),
    },
  ]);

  const summary = await getMonthlyAttendanceSummary({
    year: YEAR,
    month: MONTH,
    staffId: staff._id,
  });

  assertEq(summary.year, YEAR, "year");
  assertEq(summary.month, MONTH, "month");
  assertEq(summary.total_days_in_month, EXPECTED.total_days_in_month, "total_days_in_month");

  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary row");

  assertEq(row.holiday_count, EXPECTED.holiday_count, "holiday_count");
  assertEq(
    row.working_days_in_month,
    EXPECTED.working_days_in_month,
    "working_days_in_month"
  );
  assertEq(row.days_present, EXPECTED.days_present, "days_present");
  assertEq(row.days_late, EXPECTED.days_late, "days_late");
  assertEq(row.days_half_day, EXPECTED.days_half_day, "days_half_day");
  assertEq(row.days_paid_leave, EXPECTED.days_paid_leave, "days_paid_leave");
  assertEq(row.days_unpaid_leave, EXPECTED.days_unpaid_leave, "days_unpaid_leave");
  assertEq(row.days_on_leave, EXPECTED.days_on_leave, "days_on_leave");
  assertEq(row.days_absent, EXPECTED.days_absent, "days_absent");
  assertEq(row.payable_days, EXPECTED.payable_days, "payable_days");
  assertEq(row.unpaid_days, EXPECTED.unpaid_days, "unpaid_days");

  await cleanup();
  console.log("\n[test] Hand-count one employee one month passed");
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
