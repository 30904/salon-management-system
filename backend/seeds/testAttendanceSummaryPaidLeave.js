/**
 * Payroll Stage B test (tracker row 12):
 * Count paid vs unpaid leave — on_leave + leave_request.is_paid.
 *
 * Usage:
 *   npm run test:attendance-summary-paid-leave
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

const TEST_PHONE = "9800001212";
const PAID_DATE = new Date(Date.UTC(2026, 7, 11)); // Tue
const UNPAID_DATE = new Date(Date.UTC(2026, 7, 12)); // Wed
const ORPHAN_LEAVE_DATE = new Date(Date.UTC(2026, 7, 13)); // Thu — on_leave without leave ref

async function cleanup() {
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
  console.log("[test] Connected — paid vs unpaid leave counts\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Paid Leave Summary Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@paid-leave-summary.test`,
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

  const paidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: PAID_DATE,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Paid leave fixture",
  });
  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: UNPAID_DATE,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
    reason: "Unpaid leave fixture",
  });

  await Attendance.create([
    {
      staff_id: staff._id,
      date: PAID_DATE,
      status: "on_leave",
      leave_request_id: paidLeave._id,
      remarks: "Paid leave",
    },
    {
      staff_id: staff._id,
      date: UNPAID_DATE,
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
      remarks: "Unpaid leave",
    },
    {
      staff_id: staff._id,
      date: ORPHAN_LEAVE_DATE,
      status: "on_leave",
      leave_request_id: null,
      remarks: "Orphan on_leave counts unpaid",
    },
  ]);

  const summary = await getMonthlyAttendanceSummary({
    year: 2026,
    month: 8,
    staffId: staff._id,
  });

  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary");

  if (row.days_on_leave !== 3) {
    throw new Error(`Expected days_on_leave=3, got ${row.days_on_leave}`);
  }
  if (row.days_paid_leave !== 1) {
    throw new Error(`Expected days_paid_leave=1, got ${row.days_paid_leave}`);
  }
  if (row.days_unpaid_leave !== 2) {
    throw new Error(
      `Expected days_unpaid_leave=2 (unpaid + orphan), got ${row.days_unpaid_leave}`
    );
  }
  console.log("  PASS: days_paid_leave=1 from leave_request.is_paid true");
  console.log("  PASS: days_unpaid_leave=2 from is_paid false + missing leave ref");

  await cleanup();
  console.log("\n[test] Paid vs unpaid leave counts passed");
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
