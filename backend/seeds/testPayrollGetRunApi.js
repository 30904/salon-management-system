/**
 * Payroll Stage E test (tracker row 32):
 * GET /api/payroll/run/:id — run + entries with staff name/designation.
 *
 * Usage:
 *   npm run test:payroll-get-run-api
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

const TEST_PHONE = "9800003232";
const STAFF_NAME = "Payroll Get Run Staff";
const DESIGNATION = "Stylist";
const YEAR = 2092;
const MONTH = 4;
const BASE_SALARY = 21000;

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

async function dispatchRoute({ method, url, token }) {
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
        body: {},
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
  console.log("[test] Connected — GET /api/payroll/run/:id\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: STAFF_NAME,
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-get-run-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: DESIGNATION,
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

  const invalid = await dispatchRoute({
    method: "GET",
    url: "/payroll/run/not-a-valid-id",
    token,
  });
  const invalidStatus = invalid.err?.statusCode || invalid.statusCode;
  if (invalidStatus !== 400) {
    throw new Error(`Expected 400 for invalid id, got ${invalidStatus}`);
  }
  console.log("  PASS: invalid run id rejected");

  const missing = await dispatchRoute({
    method: "GET",
    url: `/payroll/run/${new mongoose.Types.ObjectId()}`,
    token,
  });
  const missingStatus = missing.err?.statusCode || missing.statusCode;
  if (missingStatus !== 404) {
    throw new Error(`Expected 404 for missing run, got ${missingStatus}`);
  }
  console.log("  PASS: missing run returns 404");

  const ok = await dispatchRoute({
    method: "GET",
    url: `/payroll/run/${run._id}`,
    token,
  });

  if (!ok.data?.success || ok.statusCode !== 200) {
    throw new Error(
      `Expected 200 success, got ${ok.statusCode}: ${JSON.stringify(ok.data || ok.err?.message)}`
    );
  }

  const payload = ok.data.data;
  if (!payload?.run || String(payload.run.id) !== String(run._id)) {
    throw new Error("Expected payroll run in response");
  }
  if (payload.run.month !== MONTH || payload.run.year !== YEAR) {
    throw new Error("Expected run month/year to match");
  }
  if (!Array.isArray(payload.entries)) {
    throw new Error("Expected entries array");
  }

  const entry = payload.entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry) {
    throw new Error("Expected entry for test staff");
  }
  if (entry.staff_name !== STAFF_NAME) {
    throw new Error(`Expected staff_name=${STAFF_NAME}, got ${entry.staff_name}`);
  }
  if (entry.designation !== DESIGNATION) {
    throw new Error(`Expected designation=${DESIGNATION}, got ${entry.designation}`);
  }
  console.log("  PASS: GET returns run + entries with staff name/designation");

  await cleanup();
  console.log("\n[test] GET /api/payroll/run/:id passed");
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
