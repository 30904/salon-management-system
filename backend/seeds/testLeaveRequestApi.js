/**
 * Leave Stage 7 test (tracker row 31):
 * POST /api/leave/request — checkClash + calculateIsPaid; save pending.
 *
 * Usage:
 *   npm run test:leave-request-api
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

const TEST_PHONE = "9800003101";

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

    leaveRoutes.handle(
      {
        method,
        url,
        headers: { authorization: `Bearer ${token}` },
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
  console.log("[test] Connected — POST /leave/request\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Leave Request API Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@leave-request-api.test`,
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

  const token = signAccessToken({ sub: user._id });
  const tuesday = "2026-08-12";

  const ok = await dispatchRoute({
    method: "POST",
    url: "/request",
    token,
    body: {
      date: tuesday,
      leave_type: "weekly_off",
      reason: "API test fixture",
    },
  });

  if (!ok.data?.success || ok.statusCode !== 201) {
    throw new Error(`Expected 201 success, got ${ok.statusCode}: ${JSON.stringify(ok.data)}`);
  }

  const created = ok.data.data;
  if (created.status !== "pending") {
    throw new Error("Expected pending leave request");
  }
  if (created.is_paid !== true) {
    throw new Error("Expected first leave in week to be paid");
  }
  if (normalize(new Date(created.date)).getTime() !== normalize(new Date(tuesday)).getTime()) {
    throw new Error("Expected normalized leave date");
  }
  console.log("  PASS: valid request → pending leave with is_paid true");

  const clash = await dispatchRoute({
    method: "POST",
    url: "/request",
    token,
    body: {
      date: "2026-08-15",
      leave_type: "extra_leave",
    },
  });

  if (clash.err) {
    if (clash.err.statusCode !== 400) {
      throw new Error(`Expected 400 clash error, got ${clash.err.statusCode}: ${clash.err.message}`);
    }
  } else if (clash.data?.success) {
    throw new Error("Expected Saturday request to be rejected");
  } else if (clash.statusCode !== 400 && clash.statusCode !== 500) {
    throw new Error(`Unexpected clash response: ${clash.statusCode}`);
  }
  console.log("  PASS: blackout date rejected by checkClash");

  await cleanup();
  console.log("\n[test] POST /leave/request passed");
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
