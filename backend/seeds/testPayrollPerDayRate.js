/**
 * Payroll Stage D test (tracker row 23):
 * per_day_rate = base_salary / workingDaysInMonth (holidays excluded from denominator).
 *
 * Usage:
 *   npm run test:payroll-per-day-rate
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
import Holiday from "../models/Holiday.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";
import {
  calculatePerDayRate,
  runPayrollForMonth,
} from "../services/payrollService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002323";
const YEAR = 2097;
const MONTH = 3; // March has 31 days
const BASE_SALARY = 31000;

async function cleanup() {
  await Holiday.deleteMany({ name: { $regex: /^Per Day Rate Holiday/ } });

  const run = await PayrollRun.findOne({ month: MONTH, year: YEAR });
  if (run) {
    await PayrollEntry.deleteMany({ payroll_run_id: run._id });
    await PayrollRun.deleteOne({ _id: run._id });
  }

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — per_day_rate formula\n");

  await cleanup();

  // Pure formula unit checks
  if (calculatePerDayRate(31000, 31) !== 1000) {
    throw new Error(
      `Expected calculatePerDayRate(31000,31)=1000, got ${calculatePerDayRate(31000, 31)}`
    );
  }
  if (calculatePerDayRate(31000, 0) !== 0) {
    throw new Error("Expected calculatePerDayRate with 0 days to be 0");
  }
  console.log("  PASS: calculatePerDayRate(base, workingDays) = base/workingDays");

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Per Day Rate Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@per-day-rate.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    base_salary: BASE_SALARY,
    is_active: true,
  });

  // 2 holidays in March → working days = 31 - 2 = 29
  await Holiday.create([
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 8)),
      name: "Per Day Rate Holiday A",
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 22)),
      name: "Per Day Rate Holiday B",
      branch_id: null,
      is_active: true,
    },
  ]);

  const summary = await getMonthlyAttendanceSummary({
    year: YEAR,
    month: MONTH,
    staffId: staff._id,
  });
  const staffSummary = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!staffSummary) throw new Error("Expected staff summary");

  if (staffSummary.holiday_count !== 2) {
    throw new Error(`Expected holiday_count=2, got ${staffSummary.holiday_count}`);
  }
  if (staffSummary.working_days_in_month !== 29) {
    throw new Error(
      `Expected working_days_in_month=29 (31-2 holidays), got ${staffSummary.working_days_in_month}`
    );
  }
  console.log("  PASS: workingDaysInMonth excludes holidays from denominator");

  const expectedRate = Number((BASE_SALARY / 29).toFixed(2));
  const { entries } = await runPayrollForMonth({ month: MONTH, year: YEAR });
  const entry = entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry) throw new Error("Expected payroll entry");

  if (entry.per_day_rate !== expectedRate) {
    throw new Error(
      `Expected per_day_rate=${expectedRate} (31000/29), got ${entry.per_day_rate}`
    );
  }
  console.log(`  PASS: per_day_rate = ${BASE_SALARY}/29 = ${expectedRate}`);

  await cleanup();
  console.log("\n[test] per_day_rate formula passed");
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
