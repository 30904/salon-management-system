/**
 * UAT (tracker sheet 03 row 17):
 * 1st weekly off paid; 2nd unpaid — Attendance remarks + is_paid + payroll unpaidDays agree.
 *
 * Usage:
 *   npm run test:uat-paid-unpaid-weekly-off
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
import "../models/Holiday.js";
import Attendance from "../models/Attendance.js";
import CommissionEntry from "../models/CommissionEntry.js";
import LeaveRequest from "../models/LeaveRequest.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";
import { normalize } from "../services/leaveClashService.js";
import { approveLeaveRequest, createLeaveRequest } from "../services/leaveService.js";
import { runPayrollForMonth } from "../services/payrollService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001711";
const YEAR = 2094;
const MONTH = 3;
const BASE_SALARY = 30000;

function firstUtcDateOnWeekday(year, month, weekday) {
  for (let day = 1; day <= 7; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCDay() === weekday) return date;
  }
  throw new Error(`No weekday ${weekday} in first week of ${year}-${month}`);
}

async function cleanup() {
  const run = await PayrollRun.findOne({ month: MONTH, year: YEAR });
  if (run) {
    await PayrollEntry.deleteMany({ payroll_run_id: run._id });
    await CommissionEntry.deleteMany({ payroll_run_id: run._id });
    await PayrollRun.deleteOne({ _id: run._id });
  }

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
  console.log("[test] UAT — 1st weekly off paid, 2nd unpaid\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "UAT Paid Unpaid Off",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@uat-paid-unpaid.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "UAT Colorist",
    weekly_off_day: 1,
    base_salary: BASE_SALARY,
    is_active: true,
  });

  const monday = normalize(firstUtcDateOnWeekday(YEAR, MONTH, 1));
  const wednesday = normalize(firstUtcDateOnWeekday(YEAR, MONTH, 3));
  if (wednesday.getTime() <= monday.getTime()) {
    throw new Error("Expected Wednesday after Monday in the same first week");
  }

  const first = await createLeaveRequest({
    staffId: staff._id,
    date: monday,
    leaveType: "weekly_off",
    reason: "UAT first weekly off",
  });
  if (first.is_paid !== true) {
    throw new Error(`Expected first request is_paid=true, got ${first.is_paid}`);
  }
  const approvedFirst = await approveLeaveRequest(first._id, user._id);
  if (approvedFirst.is_paid !== true || approvedFirst.status !== "approved") {
    throw new Error("Expected first weekly off approved and paid");
  }

  const paidAttendance = await Attendance.findOne({ staff_id: staff._id, date: monday });
  if (!paidAttendance || paidAttendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave for first weekly off");
  }
  if (paidAttendance.remarks !== "Paid leave") {
    throw new Error(`Expected remarks 'Paid leave', got '${paidAttendance.remarks}'`);
  }
  if (String(paidAttendance.leave_request_id) !== String(first._id)) {
    throw new Error("Expected first attendance linked to paid leave");
  }
  console.log("  PASS: 1st weekly off is_paid=true and remarks='Paid leave'");

  const second = await createLeaveRequest({
    staffId: staff._id,
    date: wednesday,
    leaveType: "weekly_off",
    reason: "UAT second weekly off same week",
  });
  if (second.is_paid !== false) {
    throw new Error(`Expected second request is_paid=false, got ${second.is_paid}`);
  }
  const approvedSecond = await approveLeaveRequest(second._id, user._id);
  if (approvedSecond.is_paid !== false || approvedSecond.status !== "approved") {
    throw new Error("Expected second weekly off approved and unpaid");
  }

  const unpaidAttendance = await Attendance.findOne({ staff_id: staff._id, date: wednesday });
  if (!unpaidAttendance || unpaidAttendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave for second weekly off");
  }
  if (unpaidAttendance.remarks !== "Unpaid leave") {
    throw new Error(`Expected remarks 'Unpaid leave', got '${unpaidAttendance.remarks}'`);
  }
  if (String(unpaidAttendance.leave_request_id) !== String(second._id)) {
    throw new Error("Expected second attendance linked to unpaid leave");
  }
  console.log("  PASS: 2nd weekly off is_paid=false and remarks='Unpaid leave'");

  const summary = await getMonthlyAttendanceSummary({
    year: YEAR,
    month: MONTH,
    staffId: staff._id,
  });
  const row = summary.payroll_summaries.find((item) => String(item.staff_id) === String(staff._id));
  if (!row) throw new Error("Expected attendance summary row for test staff");
  if (row.days_paid_leave !== 1) {
    throw new Error(`Expected days_paid_leave=1, got ${row.days_paid_leave}`);
  }
  if (row.days_unpaid_leave !== 1) {
    throw new Error(`Expected days_unpaid_leave=1, got ${row.days_unpaid_leave}`);
  }
  if (row.unpaid_days !== 1) {
    throw new Error(`Expected summary unpaid_days=1, got ${row.unpaid_days}`);
  }
  console.log("  PASS: summary unpaid_days=1 matches one unpaid leave");

  const { run, entries } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: user._id,
  });
  const entry = entries.find((item) => String(item.staff_id) === String(staff._id));
  if (!entry) throw new Error("Expected PayrollEntry for test staff");
  if (entry.unpaid_days !== 1) {
    throw new Error(`Expected payroll unpaid_days=1, got ${entry.unpaid_days}`);
  }
  if (entry.unpaid_days !== row.unpaid_days) {
    throw new Error("Payroll unpaid_days must match attendance summary unpaid_days");
  }
  console.log(
    `  PASS: payroll unpaid_days=${entry.unpaid_days} agrees with remarks + is_paid`
  );

  if (!run || run.status !== "draft") {
    throw new Error("Expected draft payroll run for UAT month");
  }

  await cleanup();
  console.log("\n[test] UAT paid/unpaid weekly off passed");
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
