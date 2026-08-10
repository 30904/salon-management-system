/**
 * Leave Stage 6 test (tracker row 27):
 * Approve pending leave → Attendance on_leave with leave_request_id linked.
 *
 * Usage:
 *   npm run test:approve-leave-attendance
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
import { approveLeaveRequest } from "../services/leaveService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002701";

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
  console.log("[test] Connected — approve leave → Attendance on_leave\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Approve Leave Attendance Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@approve-leave-attendance.test`,
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
  const approverId = new mongoose.Types.ObjectId();

  const pendingLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: tuesday,
    leave_type: "weekly_off",
    status: "pending",
    is_paid: true,
    reason: "Approve attendance sync fixture",
  });

  const beforeAttendance = await Attendance.findOne({
    staff_id: staff._id,
    date: tuesday,
  });
  if (beforeAttendance) {
    throw new Error("Expected no attendance before leave approval");
  }
  console.log("  PASS: no attendance before approval");

  const approved = await approveLeaveRequest(pendingLeave._id, approverId);
  if (approved.status !== "approved") {
    throw new Error("Expected leave status approved");
  }
  if (String(approved.approved_by) !== String(approverId)) {
    throw new Error("Expected approved_by set on leave request");
  }
  console.log("  PASS: leave request approved");

  const attendance = await Attendance.findOne({
    staff_id: staff._id,
    date: tuesday,
  });
  if (!attendance || attendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave after approval");
  }
  if (String(attendance.leave_request_id) !== String(pendingLeave._id)) {
    throw new Error("Expected leave_request_id linked on Attendance");
  }
  if (attendance.remarks !== "Paid leave") {
    throw new Error(`Expected remarks 'Paid leave', got '${attendance.remarks}'`);
  }
  console.log("  PASS: Attendance on_leave with leave_request_id linked");

  await cleanup();
  console.log("\n[test] Approve leave → Attendance passed");
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
