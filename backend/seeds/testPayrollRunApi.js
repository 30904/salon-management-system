/**
 * Payroll Stage E test (tracker row 31):
 * POST /api/payroll/run — body {month,year}; creates/updates draft run + entries.
 *
 * Usage:
 *   npm run test:payroll-run-api
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
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800003131";
const YEAR = 2093;
const MONTH = 3;
const BASE_SALARY = 22000;

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

async function dispatchRoute({ method, url, token, body }) {
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
  console.log("[test] Connected — POST /api/payroll/run\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Run API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@payroll-run-api.test`,
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

  const token = signAccessToken({ sub: user._id });

  const missing = await dispatchRoute({
    method: "POST",
    url: "/payroll/run",
    token,
    body: {},
  });
  const missingStatus = missing.err?.statusCode || missing.statusCode;
  if (missingStatus !== 400) {
    throw new Error(`Expected 400 without month/year, got ${missingStatus}`);
  }
  console.log("  PASS: missing month/year rejected");

  const created = await dispatchRoute({
    method: "POST",
    url: "/payroll/run",
    token,
    body: { month: MONTH, year: YEAR },
  });

  if (!created.data?.success || created.statusCode !== 201) {
    throw new Error(
      `Expected 201 success, got ${created.statusCode}: ${JSON.stringify(created.data || created.err?.message)}`
    );
  }

  const runPayload = created.data.data.run;
  const entriesPayload = created.data.data.entries;
  if (!runPayload || runPayload.status !== "draft") {
    throw new Error("Expected draft payroll run in response");
  }
  if (runPayload.month !== MONTH || runPayload.year !== YEAR) {
    throw new Error("Expected run month/year to match request body");
  }
  if (String(runPayload.run_by) !== String(user._id)) {
    throw new Error("Expected run_by to be the authenticated user");
  }

  const staffEntry = entriesPayload.find((e) => String(e.staff_id) === String(staff._id));
  if (!staffEntry) {
    throw new Error("Expected payroll entry for test staff");
  }
  if (staffEntry.base_salary !== BASE_SALARY) {
    throw new Error(`Expected base_salary=${BASE_SALARY}, got ${staffEntry.base_salary}`);
  }
  console.log("  PASS: POST creates draft run + entries");

  const persistedRun = await PayrollRun.findOne({ month: MONTH, year: YEAR });
  const persistedEntries = await PayrollEntry.find({ payroll_run_id: persistedRun._id });
  if (!persistedRun || persistedRun.status !== "draft") {
    throw new Error("Expected persisted draft PayrollRun");
  }
  if (!persistedEntries.some((e) => String(e.staff_id) === String(staff._id))) {
    throw new Error("Expected persisted PayrollEntry for test staff");
  }
  console.log("  PASS: draft run + entries persisted");

  staff.base_salary = 26000;
  await staff.save();

  const updated = await dispatchRoute({
    method: "POST",
    url: "/payroll/run",
    token,
    body: { month: MONTH, year: YEAR },
  });

  if (!updated.data?.success || updated.statusCode !== 201) {
    throw new Error(
      `Expected 201 on second run, got ${updated.statusCode}: ${JSON.stringify(updated.data || updated.err?.message)}`
    );
  }
  if (String(updated.data.data.run.id) !== String(runPayload.id)) {
    throw new Error("Expected second POST to update the same draft run");
  }

  const updatedEntry = updated.data.data.entries.find(
    (e) => String(e.staff_id) === String(staff._id)
  );
  if (!updatedEntry || updatedEntry.base_salary !== 26000) {
    throw new Error("Expected second POST to refresh entry amounts");
  }

  const runCount = await PayrollRun.countDocuments({ month: MONTH, year: YEAR });
  if (runCount !== 1) {
    throw new Error(`Expected 1 run after upsert, got ${runCount}`);
  }
  console.log("  PASS: second POST updates same draft run + entries");

  await cleanup();
  console.log("\n[test] POST /api/payroll/run passed");
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
