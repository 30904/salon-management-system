/**
 * Payroll Stage E test (tracker row 35):
 * GET /api/holidays?month=&year= — list holidays for month.
 *
 * Usage:
 *   npm run test:holiday-list-api
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
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800003535";
const YEAR = 2088;
const MONTH = 10;
const HOLIDAY_NAME = /^Holiday List API Test/;

async function cleanup() {
  await Holiday.deleteMany({ name: HOLIDAY_NAME });

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (user) {
    await User.deleteOne({ _id: user._id });
  }
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
  console.log("[test] Connected — GET /api/holidays\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Holiday List API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@holiday-list-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const token = signAccessToken({ sub: user._id });

  const missing = await dispatchRoute({
    method: "GET",
    url: "/holidays",
    token,
  });
  const missingStatus = missing.err?.statusCode || missing.statusCode;
  if (missingStatus !== 400) {
    throw new Error(`Expected 400 without month/year, got ${missingStatus}`);
  }
  console.log("  PASS: missing month/year rejected");

  await Holiday.create([
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 2)),
      name: "Holiday List API Test A",
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 15)),
      name: "Holiday List API Test B",
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH, 5)),
      name: "Holiday List API Test Next Month",
      branch_id: null,
      is_active: true,
    },
    {
      date: new Date(Date.UTC(YEAR, MONTH - 1, 20)),
      name: "Holiday List API Test Inactive",
      branch_id: null,
      is_active: false,
    },
  ]);

  const ok = await dispatchRoute({
    method: "GET",
    url: `/holidays?month=${MONTH}&year=${YEAR}`,
    token,
  });

  if (!ok.data?.success || ok.statusCode !== 200) {
    throw new Error(
      `Expected 200 success, got ${ok.statusCode}: ${JSON.stringify(ok.data || ok.err?.message)}`
    );
  }

  const payload = ok.data.data;
  if (payload.month !== MONTH || payload.year !== YEAR) {
    throw new Error("Expected month/year echoed in response");
  }

  const names = (payload.holidays || []).map((h) => h.name);
  if (!names.includes("Holiday List API Test A") || !names.includes("Holiday List API Test B")) {
    throw new Error(`Expected October holidays in list, got ${names.join(", ")}`);
  }
  if (names.includes("Holiday List API Test Next Month")) {
    throw new Error("Next-month holiday must not appear in October list");
  }
  if (names.includes("Holiday List API Test Inactive")) {
    throw new Error("Inactive holiday must not appear in list");
  }
  if (payload.holidays.length !== 2) {
    throw new Error(`Expected 2 active October holidays, got ${payload.holidays.length}`);
  }
  console.log("  PASS: GET lists active holidays for the requested month");

  await cleanup();
  console.log("\n[test] GET /api/holidays passed");
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
