/**
 * Leave Stage 7 test (tracker row 33):
 * POST /api/leave/:id/reject — manager reject; no Attendance write.
 *
 * Usage:
 *   npm run test:leave-reject-api
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import leaveRoutes from "../routes/leaveRoutes.js";
import Attendance from "../models/Attendance.js";
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

const STAFF_PHONE = "9800003301";
const MANAGER_PHONE = "9800003302";

async function cleanup() {
  for (const phone of [STAFF_PHONE, MANAGER_PHONE]) {
    const user = await User.findOne({ phone }).select("_id");
    if (!user) continue;

    const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
    if (profile) {
      await LeaveRequest.deleteMany({ staff_id: profile._id });
      await Attendance.deleteMany({ staff_id: profile._id });
      await StaffProfile.deleteOne({ _id: profile._id });
    }
    await User.deleteOne({ _id: user._id });
  }
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
  console.log("[test] Connected — POST /leave/:id/reject\n");

  await cleanup();

  const stylistRole =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  const managerRole =
    (await Role.findOne({ name: ROLE_NAMES.MANAGER })) ||
    (await Role.findOne({ name: ROLE_NAMES.OWNER })) ||
    stylistRole;
  if (!stylistRole) throw new Error("No role found — run seed:roles first");

  const staffUser = await User.create({
    name: "Leave Reject Staff",
    phone: STAFF_PHONE,
    email: `${STAFF_PHONE}@leave-reject-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: stylistRole._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: staffUser._id,
    designation: "Stylist",
    weekly_off_day: 2,
    is_active: true,
  });

  const managerUser = await User.create({
    name: "Leave Reject Manager",
    phone: MANAGER_PHONE,
    email: `${MANAGER_PHONE}@leave-reject-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: managerRole._id,
    is_active: true,
  });

  const staffToken = signAccessToken({ sub: staffUser._id });
  const managerToken = signAccessToken({ sub: managerUser._id });
  const thursday = "2026-08-12";

  const requested = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: staffToken,
    body: {
      date: thursday,
      leave_type: "extra_leave",
      reason: "Reject API fixture",
    },
  });

  if (!requested.data?.success || requested.statusCode !== 201) {
    throw new Error(
      `Expected pending leave via /request, got ${requested.statusCode}: ${JSON.stringify(requested.data)}`
    );
  }

  const leaveId = requested.data.data.id;
  console.log("  PASS: pending leave created via /request");

  const rejected = await dispatchRoute({
    method: "POST",
    url: `/${leaveId}/reject`,
    token: managerToken,
  });

  if (!rejected.data?.success || rejected.statusCode !== 200) {
    throw new Error(
      `Expected reject success, got ${rejected.statusCode}: ${JSON.stringify(rejected.data)}`
    );
  }

  if (rejected.data.data.status !== "rejected") {
    throw new Error("Expected leave status rejected");
  }
  console.log("  PASS: manager reject → leave status rejected");

  const attendance = await Attendance.findOne({
    staff_id: staff._id,
    date: normalize(new Date(thursday)),
  });
  if (attendance) {
    throw new Error("Expected no Attendance row after rejection");
  }
  console.log("  PASS: no Attendance write on reject");

  const duplicate = await dispatchRoute({
    method: "POST",
    url: `/${leaveId}/reject`,
    token: managerToken,
  });

  if (!duplicate.err || duplicate.err.statusCode !== 400) {
    throw new Error("Expected 400 when rejecting already-rejected leave");
  }
  console.log("  PASS: double reject rejected");

  await cleanup();
  console.log("\n[test] POST /leave/:id/reject passed");
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
