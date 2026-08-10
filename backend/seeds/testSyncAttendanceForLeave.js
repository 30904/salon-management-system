/**
 * Leave Stage 6 test (tracker row 26):
 * syncAttendanceForLeave — upsert Attendance on_leave with Paid/Unpaid remarks.
 *
 * Usage:
 *   npm run test:sync-attendance-for-leave
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
import { syncAttendanceForLeave } from "../services/leaveAttendanceSyncService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800002601";

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
  console.log("[test] Connected — syncAttendanceForLeave\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Sync Attendance Leave Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@sync-attendance-leave.test`,
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

  const wednesday = normalize(new Date("2026-08-13T12:00:00.000Z"));

  const paidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Sync fixture paid",
  });

  const syncedPaid = await syncAttendanceForLeave(paidLeave);
  if (!syncedPaid || syncedPaid.status !== "on_leave") {
    throw new Error("Expected on_leave attendance after paid leave sync");
  }
  if (syncedPaid.remarks !== "Paid leave") {
    throw new Error(`Expected remarks 'Paid leave', got '${syncedPaid.remarks}'`);
  }
  if (String(syncedPaid.leave_request_id) !== String(paidLeave._id)) {
    throw new Error("Expected leave_request_id linked on attendance");
  }
  console.log("  PASS: paid approved leave → on_leave + Paid leave remarks");

  paidLeave.is_paid = false;
  await paidLeave.save();
  const syncedUnpaid = await syncAttendanceForLeave(paidLeave);
  if (syncedUnpaid.remarks !== "Unpaid leave") {
    throw new Error(`Expected remarks 'Unpaid leave', got '${syncedUnpaid.remarks}'`);
  }
  console.log("  PASS: upsert updates remarks to Unpaid leave");

  const pendingLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: normalize(new Date("2026-08-14T12:00:00.000Z")),
    leave_type: "extra_leave",
    status: "pending",
    is_paid: true,
    reason: "Should not sync",
  });

  const skipped = await syncAttendanceForLeave(pendingLeave);
  if (skipped !== null) {
    throw new Error("Expected null when leave is not approved");
  }
  const noAttendance = await Attendance.findOne({
    staff_id: staff._id,
    date: pendingLeave.date,
  });
  if (noAttendance) {
    throw new Error("Pending leave should not create attendance");
  }
  console.log("  PASS: non-approved leave skipped");

  await cleanup();
  console.log("\n[test] syncAttendanceForLeave passed");
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
