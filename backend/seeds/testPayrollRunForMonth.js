/**
 * Payroll Stage D test (tracker row 22):
 * runPayrollForMonth — upsert draft run + entries from summary + commissions.
 *
 * Usage:
 *   npm run test:payroll-run-for-month
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

const TEST_PHONE = "9800002222";
const YEAR = 2098;
const MONTH = 11;
const BASE_SALARY = 28000;

async function cleanup() {
  await Holiday.deleteMany({ name: "Payroll Run Month Holiday" });

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

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — runPayrollForMonth\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Run Month Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-run-month.test`,
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

  await Holiday.create({
    date: new Date(Date.UTC(YEAR, MONTH - 1, 15)),
    name: "Payroll Run Month Holiday",
    branch_id: null,
    is_active: true,
  });

  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: new Date(Date.UTC(YEAR, MONTH - 1, 12)),
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
  });

  await Attendance.create([
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 17)),
      status: "present",
    },
    {
      staff_id: staff._id,
      date: new Date(Date.UTC(YEAR, MONTH - 1, 12)),
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
    },
  ]);

  await CommissionEntry.create({
    staff_id: staff._id,
    commission_amount: 1500,
    status: "accrued",
    calculated_at: new Date(Date.UTC(YEAR, MONTH - 1, 20, 12, 0, 0)),
    service_label: "Haircut",
  });

  const approverId = new mongoose.Types.ObjectId();
  const { run, entries } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: approverId,
  });

  if (!run || run.status !== "draft") {
    throw new Error("Expected draft PayrollRun");
  }
  if (String(run.run_by) !== String(approverId)) {
    throw new Error("Expected run_by set on PayrollRun");
  }
  console.log("  PASS: upserted draft PayrollRun");

  const entry = entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry) throw new Error("Expected PayrollEntry for test staff");

  // Nov has 30 days; working days = 30 - 1 holiday = 29
  // unpaid days = 1
  // per_day = 28000/29
  // deduction = round(28000/29 * 1)
  // net = 28000 - deduction + 1500
  const expectedWorking = 29;
  const expectedPerDay = Number((BASE_SALARY / expectedWorking).toFixed(2));
  const expectedDeduction = Math.round((BASE_SALARY / expectedWorking) * 1);
  const expectedNet = Number((BASE_SALARY - expectedDeduction + 1500).toFixed(2));

  if (entry.working_days_in_month !== expectedWorking) {
    throw new Error(
      `Expected working_days_in_month=${expectedWorking}, got ${entry.working_days_in_month}`
    );
  }
  if (entry.unpaid_days !== 1) {
    throw new Error(`Expected unpaid_days=1, got ${entry.unpaid_days}`);
  }
  if (entry.per_day_rate !== expectedPerDay) {
    throw new Error(`Expected per_day_rate=${expectedPerDay}, got ${entry.per_day_rate}`);
  }
  if (entry.deduction_amount !== expectedDeduction) {
    throw new Error(
      `Expected deduction_amount=${expectedDeduction}, got ${entry.deduction_amount}`
    );
  }
  if (entry.commission_total !== 1500) {
    throw new Error(`Expected commission_total=1500, got ${entry.commission_total}`);
  }
  if (entry.net_payable !== expectedNet) {
    throw new Error(`Expected net_payable=${expectedNet}, got ${entry.net_payable}`);
  }
  console.log("  PASS: entry amounts from summary + commission formulas");

  const linked = await CommissionEntry.findOne({
    staff_id: staff._id,
    payroll_run_id: run._id,
    status: "paid",
  });
  if (!linked) {
    throw new Error("Expected commission linked as paid to payroll run");
  }
  console.log("  PASS: accrued commission linked paid to run");

  await cleanup();
  console.log("\n[test] runPayrollForMonth passed");
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
