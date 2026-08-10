/**
 * Payroll Stage D test (tracker row 25):
 * Link CommissionEntry to run — payroll_run_id + status paid;
 * not double-counted next month.
 *
 * Usage:
 *   npm run test:payroll-link-commissions
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
import CommissionEntry from "../models/CommissionEntry.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import {
  linkCommissionsToPayrollRun,
  runPayrollForMonth,
} from "../services/payrollService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002525";
const YEAR = 2096;
const MONTH_A = 4;
const MONTH_B = 5;
const BASE_SALARY = 20000;

async function cleanup() {
  for (const month of [MONTH_A, MONTH_B]) {
    const run = await PayrollRun.findOne({ month, year: YEAR });
    if (run) {
      await PayrollEntry.deleteMany({ payroll_run_id: run._id });
      await CommissionEntry.updateMany(
        { payroll_run_id: run._id },
        { $set: { payroll_run_id: null, status: "accrued" } }
      );
      await PayrollRun.deleteOne({ _id: run._id });
    }
  }

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await CommissionEntry.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — link CommissionEntry to payroll run\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Link Commission Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-link-commission.test`,
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

  const commissionA = await CommissionEntry.create({
    staff_id: staff._id,
    commission_amount: 1200,
    status: "accrued",
    calculated_at: new Date(Date.UTC(YEAR, MONTH_A - 1, 10, 12, 0, 0)),
    service_label: "April service",
  });

  // Helper unit check
  const fakeRunId = new mongoose.Types.ObjectId();
  const linkResult = await linkCommissionsToPayrollRun([commissionA._id], fakeRunId);
  if (linkResult.modifiedCount < 1) {
    throw new Error("Expected linkCommissionsToPayrollRun to modify commission");
  }
  const linkedOnce = await CommissionEntry.findById(commissionA._id);
  if (linkedOnce.status !== "paid" || String(linkedOnce.payroll_run_id) !== String(fakeRunId)) {
    throw new Error("Expected commission status paid + payroll_run_id set");
  }
  console.log("  PASS: linkCommissionsToPayrollRun sets status=paid and payroll_run_id");

  // Reset to accrued for full month-run flow
  await CommissionEntry.updateOne(
    { _id: commissionA._id },
    { $set: { status: "accrued", payroll_run_id: null } }
  );

  const { run: runA, entries: entriesA } = await runPayrollForMonth({
    month: MONTH_A,
    year: YEAR,
  });

  const entryA = entriesA.find((e) => String(e.staff_id) === String(staff._id));
  if (!entryA || entryA.commission_total !== 1200) {
    throw new Error(
      `Expected April commission_total=1200, got ${entryA?.commission_total}`
    );
  }

  const afterApril = await CommissionEntry.findById(commissionA._id);
  if (afterApril.status !== "paid" || String(afterApril.payroll_run_id) !== String(runA._id)) {
    throw new Error("Expected April commission linked to April payroll run");
  }
  console.log("  PASS: April run links commission as paid");

  // New May commission only — April paid commission must not appear
  await CommissionEntry.create({
    staff_id: staff._id,
    commission_amount: 400,
    status: "accrued",
    calculated_at: new Date(Date.UTC(YEAR, MONTH_B - 1, 5, 12, 0, 0)),
    service_label: "May service",
  });

  const { entries: entriesB } = await runPayrollForMonth({
    month: MONTH_B,
    year: YEAR,
  });

  const entryB = entriesB.find((e) => String(e.staff_id) === String(staff._id));
  if (!entryB) throw new Error("Expected May payroll entry");
  if (entryB.commission_total !== 400) {
    throw new Error(
      `Expected May commission_total=400 (April not double-counted), got ${entryB.commission_total}`
    );
  }
  console.log("  PASS: April paid commission not double-counted in May");

  const stillApril = await CommissionEntry.findById(commissionA._id);
  if (String(stillApril.payroll_run_id) !== String(runA._id) || stillApril.status !== "paid") {
    throw new Error("Expected April commission to remain linked to April run");
  }
  console.log("  PASS: prior-month commission link unchanged");

  await cleanup();
  console.log("\n[test] Commission link to payroll run passed");
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
