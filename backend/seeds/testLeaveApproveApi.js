/**
 * Leave Stage 7 test (tracker row 32):
 * POST /api/leave/:id/approve — manager approve + sync Attendance on_leave.
 *
 * Usage:
 *   npm run test:leave-approve-api
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

const STAFF_PHONE = "9800003201";
const MANAGER_PHONE = "9800003202";

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
  console.log("[test] Connected — POST /leave/:id/approve\n");

  await cleanup();

  const stylistRole =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  const managerRole =
    (await Role.findOne({ name: ROLE_NAMES.MANAGER })) ||
    (await Role.findOne({ name: ROLE_NAMES.OWNER })) ||
    stylistRole;
  if (!stylistRole) throw new Error("No role found — run seed:roles first");

  const staffUser = await User.create({
    name: "Leave Approve Staff",
    phone: STAFF_PHONE,
    email: `${STAFF_PHONE}@leave-approve-api.test`,
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
    name: "Leave Approve Manager",
    phone: MANAGER_PHONE,
    email: `${MANAGER_PHONE}@leave-approve-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: managerRole._id,
    is_active: true,
  });

  const staffToken = signAccessToken({ sub: staffUser._id });
  const managerToken = signAccessToken({ sub: managerUser._id });
  const wednesday = "2026-08-13";

  const requested = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: staffToken,
    body: {
      date: wednesday,
      leave_type: "weekly_off",
      reason: "Approve API fixture",
    },
  });

  if (!requested.data?.success || requested.statusCode !== 201) {
    throw new Error(
      `Expected pending leave via /request, got ${requested.statusCode}: ${JSON.stringify(requested.data)}`
    );
  }

  const leaveId = requested.data.data.id;
  console.log("  PASS: pending leave created via /request");

  const approved = await dispatchRoute({
    method: "POST",
    url: `/${leaveId}/approve`,
    token: managerToken,
  });

  if (!approved.data?.success || approved.statusCode !== 200) {
    throw new Error(
      `Expected approve success, got ${approved.statusCode}: ${JSON.stringify(approved.data)}`
    );
  }

  if (approved.data.data.status !== "approved") {
    throw new Error("Expected leave status approved");
  }
  if (String(approved.data.data.approved_by) !== String(managerUser._id)) {
    throw new Error("Expected approved_by set to manager user");
  }
  console.log("  PASS: manager approve → leave status approved");

  const attendance = await Attendance.findOne({
    staff_id: staff._id,
    date: normalize(new Date(wednesday)),
  });
  if (!attendance || attendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave after approval");
  }
  if (String(attendance.leave_request_id) !== String(leaveId)) {
    throw new Error("Expected leave_request_id linked on Attendance");
  }
  console.log("  PASS: Attendance on_leave synced with leave_request_id");

  const duplicate = await dispatchRoute({
    method: "POST",
    url: `/${leaveId}/approve`,
    token: managerToken,
  });

  if (!duplicate.err || duplicate.err.statusCode !== 400) {
    throw new Error("Expected 400 when approving already-approved leave");
  }
  console.log("  PASS: double approve rejected");

  await cleanup();
  console.log("\n[test] POST /leave/:id/approve passed");
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
