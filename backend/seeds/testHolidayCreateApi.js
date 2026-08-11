/**
 * Payroll Stage E test (tracker row 36):
 * POST /api/holidays — admin adds holiday date.
 *
 * Usage:
 *   npm run test:holiday-create-api
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import apiRoutes from "../routes/index.js";
import Holiday from "../models/Holiday.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { normalize } from "../services/leaveClashService.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800003636";
const YEAR = 2087;
const MONTH = 12;
const HOLIDAY_DATE = `${YEAR}-12-25`;
const HOLIDAY_NAME = "Holiday Create API Test Christmas";

async function cleanup() {
  await Holiday.deleteMany({ name: HOLIDAY_NAME });

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (user) {
    await User.deleteOne({ _id: user._id });
  }
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
        body,
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
  console.log("[test] Connected — POST /api/holidays\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Holiday Create API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@holiday-create-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const token = signAccessToken({ sub: user._id });

  const missing = await dispatchRoute({
    method: "POST",
    url: "/holidays",
    token,
    body: {},
  });
  const missingStatus = missing.err?.statusCode || missing.statusCode;
  if (missingStatus !== 400) {
    throw new Error(`Expected 400 without date/name, got ${missingStatus}`);
  }
  console.log("  PASS: missing date/name rejected");

  const created = await dispatchRoute({
    method: "POST",
    url: "/holidays",
    token,
    body: { date: HOLIDAY_DATE, name: HOLIDAY_NAME },
  });

  if (!created.data?.success || created.statusCode !== 201) {
    throw new Error(
      `Expected 201 success, got ${created.statusCode}: ${JSON.stringify(created.data || created.err?.message)}`
    );
  }

  const payload = created.data.data;
  if (payload.name !== HOLIDAY_NAME) {
    throw new Error(`Expected name=${HOLIDAY_NAME}, got ${payload.name}`);
  }
  if (payload.branch_id != null) {
    throw new Error("Expected company-wide holiday (branch_id null)");
  }
  if (normalize(new Date(payload.date)).getTime() !== normalize(new Date(HOLIDAY_DATE)).getTime()) {
    throw new Error("Expected holiday date normalized to UTC midnight");
  }
  console.log("  PASS: POST creates holiday at UTC midnight");

  const persisted = await Holiday.findById(payload.id);
  if (!persisted || persisted.name !== HOLIDAY_NAME) {
    throw new Error("Expected holiday persisted in DB");
  }
  console.log("  PASS: holiday persisted");

  const listed = await dispatchRoute({
    method: "GET",
    url: `/holidays?month=${MONTH}&year=${YEAR}`,
    token,
  });
  const names = (listed.data?.data?.holidays || []).map((h) => h.name);
  if (!names.includes(HOLIDAY_NAME)) {
    throw new Error("Expected created holiday in month list");
  }
  console.log("  PASS: created holiday appears in GET month list");

  const duplicate = await dispatchRoute({
    method: "POST",
    url: "/holidays",
    token,
    body: { date: HOLIDAY_DATE, name: HOLIDAY_NAME },
  });
  const duplicateStatus = duplicate.err?.statusCode || duplicate.statusCode;
  if (duplicateStatus !== 409) {
    throw new Error(`Expected 409 on duplicate date, got ${duplicateStatus}`);
  }
  console.log("  PASS: duplicate date rejected");

  await cleanup();
  console.log("\n[test] POST /api/holidays passed");
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
