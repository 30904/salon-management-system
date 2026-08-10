/**
 * Payroll Stage D test (tracker row 27):
 * Upsert same month does not duplicate —
 * second runPayrollForMonth updates same entries.
 *
 * Usage:
 *   npm run test:payroll-upsert
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

const TEST_PHONE = "9800002727";
const YEAR = 2094;
const MONTH = 8;
const BASE_SALARY_1 = 20000;
const BASE_SALARY_2 = 25000;

async function cleanup() {
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
  console.log("[test] Connected — payroll upsert same month\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Upsert Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-upsert.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    base_salary: BASE_SALARY_1,
    is_active: true,
  });

  const first = await runPayrollForMonth({ month: MONTH, year: YEAR });
  const entry1 = first.entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry1) throw new Error("Expected entry after first run");
  if (entry1.base_salary !== BASE_SALARY_1) {
    throw new Error(`Expected base_salary=${BASE_SALARY_1}, got ${entry1.base_salary}`);
  }
  console.log("  PASS: first run created draft run + entry");

  // Change salary so second run must update (not just no-op)
  staff.base_salary = BASE_SALARY_2;
  await staff.save();

  const second = await runPayrollForMonth({ month: MONTH, year: YEAR });
  const entry2 = second.entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry2) throw new Error("Expected entry after second run");

  if (String(second.run._id) !== String(first.run._id)) {
    throw new Error("Expected same PayrollRun id on second run (no duplicate run)");
  }
  console.log("  PASS: second run reuses same PayrollRun");

  if (String(entry2._id) !== String(entry1._id)) {
    throw new Error("Expected same PayrollEntry id on second run (no duplicate entry)");
  }
  console.log("  PASS: second run updates same PayrollEntry");

  if (entry2.base_salary !== BASE_SALARY_2) {
    throw new Error(
      `Expected updated base_salary=${BASE_SALARY_2}, got ${entry2.base_salary}`
    );
  }
  console.log("  PASS: entry amounts refreshed on second run");

  const runCount = await PayrollRun.countDocuments({ month: MONTH, year: YEAR });
  if (runCount !== 1) {
    throw new Error(`Expected 1 PayrollRun for month, got ${runCount}`);
  }

  const entryCount = await PayrollEntry.countDocuments({
    payroll_run_id: first.run._id,
    staff_id: staff._id,
  });
  if (entryCount !== 1) {
    throw new Error(`Expected 1 PayrollEntry for staff in run, got ${entryCount}`);
  }
  console.log("  PASS: DB has exactly one run and one entry for staff");

  await cleanup();
  console.log("\n[test] payroll upsert same month passed");
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
