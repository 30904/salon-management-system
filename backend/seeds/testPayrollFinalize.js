/**
 * Payroll Stage D test (tracker row 26):
 * finalizePayrollRun — status finalized + finalized_at;
 * further calc rejected.
 *
 * Usage:
 *   npm run test:payroll-finalize
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
import { AppError } from "../utils/AppError.js";
import {
  finalizePayrollRun,
  runPayrollForMonth,
} from "../services/payrollService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002626";
const YEAR = 2095;
const MONTH = 6;
const BASE_SALARY = 18000;

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

async function expectAppError(fn, statusCode, messageIncludes) {
  try {
    await fn();
    throw new Error("Expected AppError to be thrown");
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    if (err.statusCode !== statusCode) {
      throw new Error(`Expected status ${statusCode}, got ${err.statusCode}: ${err.message}`);
    }
    if (messageIncludes && !String(err.message).includes(messageIncludes)) {
      throw new Error(`Expected message to include "${messageIncludes}", got: ${err.message}`);
    }
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — finalizePayrollRun\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Finalize Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-finalize.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    base_salary: BASE_SALARY,
    is_active: true,
  });

  const { run } = await runPayrollForMonth({ month: MONTH, year: YEAR, runBy: user._id });
  if (run.status !== "draft" || run.finalized_at != null) {
    throw new Error("Expected draft run with null finalized_at before finalize");
  }
  console.log("  PASS: draft run created");

  const finalized = await finalizePayrollRun(run._id);
  if (finalized.status !== "finalized" || !finalized.finalized_at) {
    throw new Error("Expected status finalized and finalized_at set");
  }
  console.log("  PASS: finalizePayrollRun sets status + finalized_at");

  const reloaded = await PayrollRun.findById(run._id);
  if (reloaded.status !== "finalized" || !reloaded.finalized_at) {
    throw new Error("Expected persisted finalized run");
  }
  console.log("  PASS: finalized state persisted");

  await expectAppError(
    () => finalizePayrollRun(run._id),
    400,
    "already finalized"
  );
  console.log("  PASS: second finalize rejected");

  await expectAppError(
    () => runPayrollForMonth({ month: MONTH, year: YEAR }),
    400,
    "finalized"
  );
  console.log("  PASS: further calc rejected after finalize");

  await expectAppError(
    () => finalizePayrollRun(new mongoose.Types.ObjectId()),
    404,
    "not found"
  );
  console.log("  PASS: missing run returns 404");

  await cleanup();
  console.log("\n[test] finalizePayrollRun passed");
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
