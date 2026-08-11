/**
 * UAT (tracker sheet 03 row 19 / Payroll guide §8):
 * Hand-calc net_payable for one employee one month; match PayrollEntry
 * before trusting a real staff run.
 *
 * June 2096 fixture (hand-calc):
 *   calendar days            = 30
 *   holidays                 = 2  →  workingDays = 30 - 2 = 28
 *   unpaid leave             = 1  →  unpaidDays = 1
 *   present                  = 2
 *   base_salary              = 25000
 *   commission               = 1750
 *
 *   per_day_rate (4 dp)      = 25000 / 28 = 892.8571
 *   stored per_day_rate      = 892.86
 *   deduction                = round(892.8571 × 1) = 893
 *   net_payable              = 25000 - 893 + 1750 = 25857
 *
 * Usage:
 *   npm run test:uat-hand-calc-net
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
import LeaveRequest from "../models/LeaveRequest.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { runPayrollForMonth } from "../services/payrollService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001911";
const YEAR = 2096;
const MONTH = 6;
const HOLIDAY_NAME = "UAT Hand Calc Holiday";

const HAND = {
  calendar_days: 30,
  holiday_count: 2,
  working_days: 28,
  unpaid_days: 1,
  base_salary: 25000,
  commission_total: 1750,
  per_day_rate: 892.86,
  deduction_amount: 893,
  net_payable: 25857,
};

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
    await LeaveRequest.deleteMany({ staff_id: profile._id });
    await Attendance.deleteMany({ staff_id: profile._id });
    await CommissionEntry.deleteMany({ staff_id: profile._id });
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
  console.log("[test] UAT — hand-calc net_payable one employee one month\n");
  console.log("  Hand-calc: 25000 / 28 = 892.8571; round(892.8571) = 893; 25000 - 893 + 1750 = 25857\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "UAT Hand Calc Net",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@uat-hand-calc-net.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "UAT Hand Calc Stylist",
    weekly_off_day: 2,
    base_salary: HAND.base_salary,
    is_active: true,
  });

  await Holiday.create([
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 5)),
      name: `${HOLIDAY_NAME} 1`,
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 15)),
      name: `${HOLIDAY_NAME} 2`,
      branch_id: null,
      is_active: true,
    },
  ]);

  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: new Date(Date.UTC(YEAR, MONTH - 1, 7)),
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
    reason: "UAT unpaid day for net hand-calc",
  });

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
      date: new Date(Date.UTC(YEAR, MONTH - 1, 7)),
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
      remarks: "Unpaid leave",
    },
  ]);

  await CommissionEntry.create({
    staff_id: staff._id,
    commission_amount: HAND.commission_total,
    status: "accrued",
    calculated_at: new Date(Date.UTC(YEAR, MONTH - 1, 20, 12, 0, 0)),
    service_label: "UAT color service",
  });

  const juneDays = new Date(Date.UTC(YEAR, MONTH, 0)).getUTCDate();
  assertEq(juneDays, HAND.calendar_days, "June calendar days");

  const { run, entries } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: user._id,
  });
  if (!run || run.status !== "draft") {
    throw new Error("Expected draft PayrollRun");
  }

  const entry = entries.find((item) => String(item.staff_id) === String(staff._id));
  if (!entry) throw new Error("Expected PayrollEntry for hand-calc staff");

  assertEq(entry.base_salary, HAND.base_salary, "base_salary");
  assertEq(entry.working_days_in_month, HAND.working_days, "working_days_in_month (30-2)");
  assertEq(entry.unpaid_days, HAND.unpaid_days, "unpaid_days");
  assertEq(entry.per_day_rate, HAND.per_day_rate, "per_day_rate");
  assertEq(entry.deduction_amount, HAND.deduction_amount, "deduction_amount");
  assertEq(entry.commission_total, HAND.commission_total, "commission_total");
  assertEq(entry.net_payable, HAND.net_payable, "net_payable = base - deduction + commission");

  await cleanup();
  console.log("\n[test] UAT hand-calc net_payable passed");
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
