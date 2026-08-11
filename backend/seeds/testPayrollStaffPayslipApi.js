/**
 * Payroll Stage E test (tracker row 34):
 * GET /api/payroll/staff/:staffId?month=&year= — employee payslip for MyEarnings.
 *
 * Usage:
 *   npm run test:payroll-staff-payslip-api
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

const TEST_PHONE = "9800003434";
const STAFF_NAME = "Payroll Payslip Staff";
const DESIGNATION = "Stylist";
const YEAR = 2090;
const MONTH = 9;
const BASE_SALARY = 24000;

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

    const [path, queryString] = url.split("?");
    const query = {};
    if (queryString) {
      for (const part of queryString.split("&")) {
        const [key, value] = part.split("=");
        query[key] = decodeURIComponent(value || "");
      }
    }

    apiRoutes.handle(
      {
        method,
        url: path,
        query,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: {},
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
  console.log("[test] Connected — GET /api/payroll/staff/:staffId\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: STAFF_NAME,
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-staff-payslip-api.test`,
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

  const token = signAccessToken({ sub: user._id });

  const missingQuery = await dispatchRoute({
    method: "GET",
    url: `/payroll/staff/${staff._id}`,
    token,
  });
  const missingQueryStatus = missingQuery.err?.statusCode || missingQuery.statusCode;
  if (missingQueryStatus !== 400) {
    throw new Error(`Expected 400 without month/year, got ${missingQueryStatus}`);
  }
  console.log("  PASS: missing month/year rejected");

  const invalidStaff = await dispatchRoute({
    method: "GET",
    url: `/payroll/staff/not-a-valid-id?month=${MONTH}&year=${YEAR}`,
    token,
  });
  const invalidStaffStatus = invalidStaff.err?.statusCode || invalidStaff.statusCode;
  if (invalidStaffStatus !== 400) {
    throw new Error(`Expected 400 for invalid staff id, got ${invalidStaffStatus}`);
  }
  console.log("  PASS: invalid staff id rejected");

  const missingStaff = await dispatchRoute({
    method: "GET",
    url: `/payroll/staff/${new mongoose.Types.ObjectId()}?month=${MONTH}&year=${YEAR}`,
    token,
  });
  const missingStaffStatus = missingStaff.err?.statusCode || missingStaff.statusCode;
  if (missingStaffStatus !== 404) {
    throw new Error(`Expected 404 for missing staff, got ${missingStaffStatus}`);
  }
  console.log("  PASS: missing staff returns 404");

  const empty = await dispatchRoute({
    method: "GET",
    url: `/payroll/staff/${staff._id}?month=${MONTH}&year=${YEAR}`,
    token,
  });
  if (!empty.data?.success || empty.statusCode !== 200) {
    throw new Error(
      `Expected 200 with empty payslip, got ${empty.statusCode}: ${JSON.stringify(empty.data || empty.err?.message)}`
    );
  }
  if (empty.data.data.run !== null || empty.data.data.entry !== null) {
    throw new Error("Expected null run/entry when no payroll exists");
  }
  if (empty.data.data.staff?.name !== STAFF_NAME || empty.data.data.staff?.designation !== DESIGNATION) {
    throw new Error("Expected staff name/designation on empty payslip");
  }
  console.log("  PASS: no run yet returns staff info with null payslip");

  const { run } = await runPayrollForMonth({
    month: MONTH,
    year: YEAR,
    runBy: user._id,
  });

  const ok = await dispatchRoute({
    method: "GET",
    url: `/payroll/staff/${staff._id}?month=${MONTH}&year=${YEAR}`,
    token,
  });
  if (!ok.data?.success || ok.statusCode !== 200) {
    throw new Error(
      `Expected 200 payslip, got ${ok.statusCode}: ${JSON.stringify(ok.data || ok.err?.message)}`
    );
  }

  const payload = ok.data.data;
  if (!payload.run || String(payload.run.id) !== String(run._id)) {
    throw new Error("Expected payslip run to match payroll run");
  }
  if (!payload.entry || String(payload.entry.staff_id) !== String(staff._id)) {
    throw new Error("Expected payslip entry for this staff");
  }
  if (payload.entry.base_salary !== BASE_SALARY) {
    throw new Error(`Expected base_salary=${BASE_SALARY}, got ${payload.entry.base_salary}`);
  }
  if (payload.entry.staff_name !== STAFF_NAME || payload.entry.designation !== DESIGNATION) {
    throw new Error("Expected populated staff_name and designation on entry");
  }
  if (payload.staff?.name !== STAFF_NAME || payload.staff?.designation !== DESIGNATION) {
    throw new Error("Expected staff name/designation on payslip");
  }
  console.log("  PASS: payslip returns run + entry for MyEarnings");

  await cleanup();
  console.log("\n[test] GET /api/payroll/staff/:staffId passed");
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
