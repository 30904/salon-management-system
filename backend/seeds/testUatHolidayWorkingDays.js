/**
 * UAT (tracker sheet 03 row 18):
 * Holiday excluded from working days — payableDays includes holidayCount;
 * per-day denominator excludes holiday.
 *
 * Usage:
 *   npm run test:uat-holiday-working-days
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

const TEST_PHONE = "9800001811";
const YEAR = 2095;
const MONTH = 4; // April has 30 days
const BASE_SALARY = 28000;
const HOLIDAY_NAME = "UAT Working Days Holiday";
const HOLIDAY_DATES = [
  new Date(Date.UTC(YEAR, MONTH - 1, 5)),
  new Date(Date.UTC(YEAR, MONTH - 1, 15)),
];

async function cleanup() {
  await Holiday.deleteMany({ name: { $regex: new RegExp(`^${HOLIDAY_NAME}`) } });

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
    await Attendance.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] UAT — holiday excluded from working days\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "UAT Holiday Working Days",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@uat-holiday-working-days.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "UAT Holiday Tester",
    weekly_off_day: 2,
    base_salary: BASE_SALARY,
    is_active: true,
  });

  await Holiday.create(
    HOLIDAY_DATES.map((date, index) => ({
      date,
      name: `${HOLIDAY_NAME} ${index + 1}`,
      branch_id: null,
      is_active: true,
    }))
  );

  await Attendance.create([
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 2)),
      status: "present",
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 3)),
      status: "present",
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 6)),
      status: "present",
    },
    {
      staff_id: staff._id,
      date: HOLIDAY_DATES[0],
      status: "present",
    },
  ]);

  const totalDays = new Date(Date.UTC(YEAR, MONTH, 0)).getUTCDate();
  const holidayCount = HOLIDAY_DATES.length;
  const expectedWorking = totalDays - holidayCount;
  const expectedPayable = 3 + holidayCount;

  const summary = await getMonthlyAttendanceSummary({
    year: YEAR,
    month: MONTH,
    staffId: staff._id,
  });
  const row = summary.payroll_summaries.find(
    (item) => String(item.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected attendance summary for test staff");

  if (summary.total_days_in_month !== totalDays) {
    throw new Error(`Expected total_days_in_month=${totalDays}, got ${summary.total_days_in_month}`);
  }
  if (row.holiday_count !== holidayCount) {
    throw new Error(`Expected holiday_count=${holidayCount}, got ${row.holiday_count}`);
  }
  if (row.days_present !== 3) {
    throw new Error(`Expected days_present=3 (holiday punch skipped), got ${row.days_present}`);
  }
  if (row.working_days_in_month !== expectedWorking) {
    throw new Error(
      `Expected working_days_in_month=${expectedWorking} (${totalDays}-${holidayCount}), got ${row.working_days_in_month}`
    );
  }
  console.log(
    `  PASS: working_days_in_month = ${totalDays} - ${holidayCount} = ${expectedWorking}`
  );

  if (row.payable_days !== expectedPayable) {
    throw new Error(
      `Expected payable_days=${expectedPayable} (3 present + ${holidayCount} holidays), got ${row.payable_days}`
    );
  }
  console.log(
    `  PASS: payable_days includes holidayCount (${row.days_present} present + ${row.holiday_count} holidays = ${row.payable_days})`
  );

  const { entries } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: user._id,
  });
  const entry = entries.find((item) => String(item.staff_id) === String(staff._id));
  if (!entry) throw new Error("Expected PayrollEntry for test staff");

  if (entry.working_days_in_month !== expectedWorking) {
    throw new Error(
      `Expected payroll working_days_in_month=${expectedWorking}, got ${entry.working_days_in_month}`
    );
  }
  if (entry.payable_days !== expectedPayable) {
    throw new Error(`Expected payroll payable_days=${expectedPayable}, got ${entry.payable_days}`);
  }

  const expectedRate = Number(calculatePerDayRate(BASE_SALARY, expectedWorking).toFixed(2));
  if (entry.per_day_rate !== expectedRate) {
    throw new Error(
      `Expected per_day_rate=${expectedRate} (base / ${expectedWorking}), got ${entry.per_day_rate}`
    );
  }
  if (entry.per_day_rate === Number((BASE_SALARY / totalDays).toFixed(2))) {
    throw new Error("per_day_rate used calendar days instead of excluding holidays");
  }
  console.log(
    `  PASS: per_day_rate denominator excludes holidays (${BASE_SALARY} / ${expectedWorking} = ${entry.per_day_rate})`
  );

  await cleanup();
  console.log("\n[test] UAT holiday working days passed");
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
