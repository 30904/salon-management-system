/**
 * Leave Stage 6 test (tracker row 25):
 * Attendance.leave_request_id — ObjectId ref LeaveRequest; default null.
 *
 * Usage:
 *   npm run test:attendance-leave-request-id
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { normalize } from "../services/leaveClashService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002501";

async function cleanup() {
  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await LeaveRequest.deleteMany({ staff_id: profile._id });
    await Attendance.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — Attendance.leave_request_id\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Attendance Leave Ref Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@attendance-leave-ref.test`,
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

  const tuesday = normalize(new Date("2026-08-12T12:00:00.000Z"));

  const attendanceDefault = await Attendance.create({
    staff_id: staff._id,
    date: tuesday,
    status: "present",
  });

  if (attendanceDefault.leave_request_id != null) {
    throw new Error("Expected leave_request_id default null");
  }
  console.log("  PASS: leave_request_id defaults to null");

  const leaveRequest = await LeaveRequest.create({
    staff_id: staff._id,
    date: tuesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Attendance link fixture",
  });

  attendanceDefault.leave_request_id = leaveRequest._id;
  attendanceDefault.status = "on_leave";
  await attendanceDefault.save();

  const reloaded = await Attendance.findById(attendanceDefault._id).populate("leave_request_id");
  if (!reloaded?.leave_request_id || String(reloaded.leave_request_id._id) !== String(leaveRequest._id)) {
    throw new Error("Expected leave_request_id to reference LeaveRequest");
  }
  console.log("  PASS: leave_request_id stores LeaveRequest ref");

  const safe = reloaded.toSafeObject();
  if (String(safe.leave_request_id) !== String(leaveRequest._id)) {
    throw new Error("toSafeObject should expose leave_request_id");
  }
  console.log("  PASS: toSafeObject includes leave_request_id");

  await cleanup();
  console.log("\n[test] Attendance.leave_request_id passed");
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
