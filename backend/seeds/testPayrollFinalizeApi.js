/**
 * Payroll Stage E test (tracker row 33):
 * POST /api/payroll/run/:id/finalize — locks the run.
 *
 * Usage:
 *   npm run test:payroll-finalize-api
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
import apiRoutes from "../routes/index.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { runPayrollForMonth } from "../services/payrollService.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800003333";
const YEAR = 2091;
const MONTH = 7;
const BASE_SALARY = 19000;

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

async function dispatchRoute({ method, url, token, body = {} }) {
  return new Promise((resolve) => {
    let responseData = null;
    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return mockRes;
      },
      json(data) {
        responseData = data;
        resolve({ statusCode, data });
        return mockRes;
      },
    };

    apiRoutes.handle(
      {
        method,
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body,
        query: {},
      },
      mockRes,
      (err) => {
        resolve({ statusCode: err?.statusCode || 500, data: null, err });
      }
    );
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — POST /api/payroll/run/:id/finalize\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Finalize API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-finalize-api.test`,
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

  const { run } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: user._id,
  });

  const token = signAccessToken({ sub: user._id });

  const missing = await dispatchRoute({
    method: "POST",
    url: `/payroll/run/${new mongoose.Types.ObjectId()}/finalize`,
    token,
  });
  const missingStatus = missing.err?.statusCode || missing.statusCode;
  if (missingStatus !== 404) {
    throw new Error(`Expected 404 for missing run, got ${missingStatus}`);
  }
  console.log("  PASS: missing run returns 404");

  const ok = await dispatchRoute({
    method: "POST",
    url: `/payroll/run/${run._id}/finalize`,
    token,
  });

  if (!ok.data?.success || ok.statusCode !== 200) {
    throw new Error(
      `Expected 200 success, got ${ok.statusCode}: ${JSON.stringify(ok.data || ok.err?.message)}`
    );
  }

  const payload = ok.data.data;
  if (payload.status !== "finalized" || !payload.finalized_at) {
    throw new Error("Expected response status finalized + finalized_at");
  }
  console.log("  PASS: finalize API returns locked run");

  const persisted = await PayrollRun.findById(run._id);
  if (persisted.status !== "finalized" || !persisted.finalized_at) {
    throw new Error("Expected persisted run to be finalized");
  }
  console.log("  PASS: run locked in DB");

  const again = await dispatchRoute({
    method: "POST",
    url: `/payroll/run/${run._id}/finalize`,
    token,
  });
  const againStatus = again.err?.statusCode || again.statusCode;
  if (againStatus !== 400) {
    throw new Error(`Expected 400 on second finalize, got ${againStatus}`);
  }
  console.log("  PASS: second finalize rejected");

  const recalc = await dispatchRoute({
    method: "POST",
    url: "/payroll/run",
    token,
    body: { month: MONTH, year: YEAR },
  });
  const recalcStatus = recalc.err?.statusCode || recalc.statusCode;
  if (recalcStatus !== 400) {
    throw new Error(`Expected 400 recalc after finalize, got ${recalcStatus}`);
  }
  console.log("  PASS: further calc rejected after lock");

  await cleanup();
  console.log("\n[test] POST /api/payroll/run/:id/finalize passed");
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
