/**
 * Leave Stage 7 test (tracker row 34):
 * POST /api/leave/swap — swapLeave + sync Attendance both sides.
 *
 * Usage:
 *   npm run test:leave-swap-api
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

const MANAGER_PHONE = "9800003401";
const TEST_PHONES = ["9800003402", "9800003403"];

async function cleanup() {
  const phones = [MANAGER_PHONE, ...TEST_PHONES];
  const users = await User.find({ phone: { $in: phones } }).select("_id phone");
  const userIds = users.map((u) => u._id);
  const profiles = await StaffProfile.find({ user_id: { $in: userIds } }).select("_id");

  if (profiles.length) {
    const profileIds = profiles.map((p) => p._id);
    await LeaveRequest.deleteMany({ staff_id: { $in: profileIds } });
    await Attendance.deleteMany({ staff_id: { $in: profileIds } });
    await StaffProfile.deleteMany({ _id: { $in: profileIds } });
  }
  if (userIds.length) {
    await User.deleteMany({ _id: { $in: userIds } });
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

async function createTestStaff({ phone, name, designation, roleId }) {
  const user = await User.create({
    name,
    phone,
    email: `${phone}@leave-swap-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: roleId,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation,
    weekly_off_day: 2,
    is_active: true,
  });

  return { user, staff };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — POST /leave/swap\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  const managerRole =
    (await Role.findOne({ name: ROLE_NAMES.MANAGER })) ||
    (await Role.findOne({ name: ROLE_NAMES.OWNER })) ||
    role;
  if (!role) throw new Error("No role found — run seed:roles first");

  const managerUser = await User.create({
    name: "Leave Swap Manager",
    phone: MANAGER_PHONE,
    email: `${MANAGER_PHONE}@leave-swap-api.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: managerRole._id,
    is_active: true,
  });

  const { staff: staffA } = await createTestStaff({
    phone: TEST_PHONES[0],
    name: "Swap API Staff A",
    designation: "Stylist",
    roleId: role._id,
  });
  const { staff: staffB } = await createTestStaff({
    phone: TEST_PHONES[1],
    name: "Swap API Staff B",
    designation: "Beautician",
    roleId: role._id,
  });

  const monday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  const wednesday = normalize(new Date("2026-08-13T12:00:00.000Z"));

  await LeaveRequest.create({
    staff_id: staffA._id,
    date: monday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Swap API fixture A",
  });
  await LeaveRequest.create({
    staff_id: staffB._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Swap API fixture B",
  });

  const managerToken = signAccessToken({ sub: managerUser._id });

  const swapped = await dispatchRoute({
    method: "POST",
    url: "/swap",
    token: managerToken,
    body: {
      staff_id_a: staffA._id,
      date_a: monday.toISOString(),
      staff_id_b: staffB._id,
      date_b: wednesday.toISOString(),
    },
  });

  if (!swapped.data?.success || swapped.statusCode !== 200) {
    throw new Error(
      `Expected swap success, got ${swapped.statusCode}: ${JSON.stringify(swapped.data)} ${swapped.err?.message || ""}`
    );
  }

  const leaveA = swapped.data.data.staff_a;
  const leaveB = swapped.data.data.staff_b;
  if (leaveA.leave_type !== "swapped_off" || leaveB.leave_type !== "swapped_off") {
    throw new Error("Expected both swapped_off leave records");
  }
  if (leaveA.status !== "approved" || leaveB.status !== "approved") {
    throw new Error("Expected both swap results approved");
  }
  console.log("  PASS: swap → both swapped_off approved");

  const attendanceA = await Attendance.findOne({ staff_id: staffA._id, date: wednesday });
  const attendanceB = await Attendance.findOne({ staff_id: staffB._id, date: monday });

  if (!attendanceA || attendanceA.status !== "on_leave") {
    throw new Error("Expected staff A Attendance on_leave on Wednesday");
  }
  if (!attendanceB || attendanceB.status !== "on_leave") {
    throw new Error("Expected staff B Attendance on_leave on Monday");
  }
  if (String(attendanceA.leave_request_id) !== String(leaveA.id)) {
    throw new Error("Expected staff A attendance linked to swapped leave");
  }
  if (String(attendanceB.leave_request_id) !== String(leaveB.id)) {
    throw new Error("Expected staff B attendance linked to swapped leave");
  }
  console.log("  PASS: Attendance synced on both sides with leave_request_id");

  await cleanup();
  console.log("\n[test] POST /leave/swap passed");
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
