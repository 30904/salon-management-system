/**
 * Payroll Stage B test (tracker row 13):
 * payableDays = present + late + half_day*0.5 + daysPaidLeave + holidayCount
 * unpaidDays = unpaidLeave + absent
 *
 * Usage:
 *   npm run test:attendance-summary-payable-formula
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

const TEST_PHONE = "9800001313";
const HOLIDAY_DATE = new Date(Date.UTC(2026, 7, 20));
const PRESENT_DATE = new Date(Date.UTC(2026, 7, 17)); // Mon
const LATE_DATE = new Date(Date.UTC(2026, 7, 18)); // Tue
const HALF_DATE = new Date(Date.UTC(2026, 7, 19)); // Wed
const PAID_LEAVE_DATE = new Date(Date.UTC(2026, 7, 11)); // Tue earlier week
const UNPAID_LEAVE_DATE = new Date(Date.UTC(2026, 7, 12)); // Wed
const ABSENT_DATE = new Date(Date.UTC(2026, 7, 13)); // Thu

async function cleanup() {
  await Holiday.deleteMany({ name: "Payable Formula Holiday Test" });

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
  console.log("[test] Connected — payableDays / unpaidDays formula\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payable Formula Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payable-formula.test`,
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
    name: "Payable Formula Holiday Test",
    branch_id: null,
    is_active: true,
  });

  const paidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: PAID_LEAVE_DATE,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
  });
  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: UNPAID_LEAVE_DATE,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
  });

  await Attendance.create([
    { staff_id: staff._id, date: PRESENT_DATE, status: "present" },
    { staff_id: staff._id, date: LATE_DATE, status: "late" },
    { staff_id: staff._id, date: HALF_DATE, status: "half_day" },
    {
      staff_id: staff._id,
      date: PAID_LEAVE_DATE,
      status: "on_leave",
      leave_request_id: paidLeave._id,
    },
    {
      staff_id: staff._id,
      date: UNPAID_LEAVE_DATE,
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
    },
    { staff_id: staff._id, date: ABSENT_DATE, status: "absent" },
  ]);

  // Expected:
  // present=1, late=1, half=1, paidLeave=1, holidayCount=1
  // payable = 1 + 1 + 0.5 + 1 + 1 = 4.5
  // unpaid = 1 unpaidLeave + 1 absent = 2

  const summary = await getMonthlyAttendanceSummary({
    year: 2026,
    month: 8,
    staffId: staff._id,
  });

  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary");

  if (row.holiday_count !== 1) {
    throw new Error(`Expected holiday_count=1, got ${row.holiday_count}`);
  }
  if (row.payable_days !== 4.5) {
    throw new Error(`Expected payable_days=4.5, got ${row.payable_days}`);
  }
  console.log("  PASS: payable_days = present+late+half*0.5+paidLeave+holidayCount = 4.5");

  if (row.unpaid_days !== 2) {
    throw new Error(`Expected unpaid_days=2, got ${row.unpaid_days}`);
  }
  console.log("  PASS: unpaid_days = unpaidLeave + absent = 2");

  await cleanup();
  console.log("\n[test] payableDays / unpaidDays formula passed");
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
