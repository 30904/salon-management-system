/**
 * Leave Stage 7 test (tracker row 35):
 * GET /api/leave?staff_id=&month= — list leave for staff / calendar view.
 *
 * Usage:
 *   npm run test:leave-list-api
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import leaveRoutes from "../routes/leaveRoutes.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
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

const TEST_PHONE = "9800003501";

async function cleanup() {
  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await LeaveRequest.deleteMany({ staff_id: profile._id });
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

    leaveRoutes.handle(
      {
        method,
        url: path,
        query,
        headers: { authorization: `Bearer ${token}` },
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
  console.log("[test] Connected — GET /leave?staff_id=&month=\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Leave List API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@leave-list-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    is_active: true,
  });

  await LeaveRequest.create([
    {
      staff_id: staff._id,
      date: normalize(new Date("2026-08-11T12:00:00.000Z")),
      leave_type: "weekly_off",
      status: "approved",
      is_paid: true,
      reason: "August leave 1",
    },
    {
      staff_id: staff._id,
      date: normalize(new Date("2026-08-13T12:00:00.000Z")),
      leave_type: "extra_leave",
      status: "pending",
      is_paid: true,
      reason: "August leave 2",
    },
    {
      staff_id: staff._id,
      date: normalize(new Date("2026-09-08T12:00:00.000Z")),
      leave_type: "extra_leave",
      status: "approved",
      is_paid: true,
      reason: "September leave",
    },
  ]);

  const token = signAccessToken({ sub: user._id });

  const august = await dispatchRoute({
    method: "GET",
    url: `/?month=2026-08`,
    token,
  });

  if (!august.data?.success || august.statusCode !== 200) {
    throw new Error(
      `Expected August list success, got ${august.statusCode}: ${JSON.stringify(august.data)}`
    );
  }

  if (august.data.data.leaves.length !== 2) {
    throw new Error(`Expected 2 August leaves, got ${august.data.data.leaves.length}`);
  }
  if (august.data.data.month !== "2026-08") {
    throw new Error(`Expected month 2026-08, got ${august.data.data.month}`);
  }
  console.log("  PASS: month=2026-08 returns 2 leave rows");

  const byStaff = await dispatchRoute({
    method: "GET",
    url: `/?staff_id=${staff._id}&month=2026-09`,
    token,
  });

  if (byStaff.data.data.leaves.length !== 1) {
    throw new Error(`Expected 1 September leave, got ${byStaff.data.data.leaves.length}`);
  }
  console.log("  PASS: staff_id + month filter returns expected row");

  const all = await dispatchRoute({
    method: "GET",
    url: "/",
    token,
  });

  if (all.data.data.leaves.length !== 3) {
    throw new Error(`Expected 3 total leaves without month filter, got ${all.data.data.leaves.length}`);
  }
  console.log("  PASS: no month filter returns all leave rows");

  await cleanup();
  console.log("\n[test] GET /leave list passed");
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
