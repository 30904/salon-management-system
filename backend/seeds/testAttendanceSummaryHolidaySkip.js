/**
 * Payroll Stage B test (tracker row 11):
 * Holiday-aware day loop — holiday date skips present/leave/absent counting.
 *
 * Usage:
 *   npm run test:attendance-summary-holiday-skip
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

const TEST_PHONE = "9800001111";
const HOLIDAY_DATE = new Date(Date.UTC(2026, 7, 20)); // Thu 20 Aug 2026
const PRESENT_DATE = new Date(Date.UTC(2026, 7, 19)); // Wed 19 Aug 2026
const LEAVE_DATE = new Date(Date.UTC(2026, 7, 18)); // Tue 18 Aug 2026

async function cleanup() {
  await Holiday.deleteMany({
    name: { $regex: /^Holiday Skip Test Day/ },
  });

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

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — holiday-aware day loop\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Holiday Skip Summary Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@holiday-skip-summary.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    is_active: true,
  });

  await Holiday.create({
    date: HOLIDAY_DATE,
    name: "Holiday Skip Test Day",
    branch_id: null,
    is_active: true,
  });

  const leave = await LeaveRequest.create({
    staff_id: staff._id,
    date: LEAVE_DATE,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: true,
    reason: "Non-holiday leave",
  });

  await Attendance.create([
    {
      staff_id: staff._id,
      date: PRESENT_DATE,
      status: "present",
      punch_in_time: new Date(Date.UTC(2026, 7, 19, 9, 0)),
      punch_out_time: new Date(Date.UTC(2026, 7, 19, 18, 0)),
    },
    {
      staff_id: staff._id,
      date: LEAVE_DATE,
      status: "on_leave",
      leave_request_id: leave._id,
      remarks: "Paid leave",
    },
    // Marked present on a holiday — must NOT count toward days_present
    {
      staff_id: staff._id,
      date: HOLIDAY_DATE,
      status: "present",
      punch_in_time: new Date(Date.UTC(2026, 7, 20, 9, 0)),
      punch_out_time: new Date(Date.UTC(2026, 7, 20, 18, 0)),
    },
  ]);

  // Separate holiday absent day (same holiday date would overwrite counting path;
  // use a second holiday date for absent skip check)
  const HOLIDAY_ABSENT = new Date(Date.UTC(2026, 7, 21));
  await Holiday.create({
    date: HOLIDAY_ABSENT,
    name: "Holiday Skip Test Day 2",
    branch_id: null,
    is_active: true,
  });
  await Attendance.create({
    staff_id: staff._id,
    date: HOLIDAY_ABSENT,
    status: "absent",
  });

  const summary = await getMonthlyAttendanceSummary({
    year: 2026,
    month: 8,
    staffId: staff._id,
  });

  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary");

  if (row.days_present !== 1) {
    throw new Error(
      `Expected days_present=1 (holiday present skipped), got ${row.days_present}`
    );
  }
  console.log("  PASS: holiday present punch not counted in days_present");

  if (row.days_on_leave !== 1) {
    throw new Error(`Expected days_on_leave=1, got ${row.days_on_leave}`);
  }
  console.log("  PASS: non-holiday leave still counted");

  if (row.days_absent !== 0) {
    throw new Error(
      `Expected days_absent=0 (holiday absent skipped), got ${row.days_absent}`
    );
  }
  console.log("  PASS: holiday absent not counted in days_absent");

  await cleanup();
  console.log("\n[test] Holiday-aware day loop passed");
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
