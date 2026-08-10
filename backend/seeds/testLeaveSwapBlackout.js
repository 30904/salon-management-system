/**
 * Leave Stage 5 test (tracker row 22):
 * Swap into blackout (Sat) → success:false; no writes.
 *
 * Usage:
 *   npm run test:leave-swap-blackout
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { normalize } from "../services/leaveClashService.js";
import { swapLeave } from "../services/leaveSwapService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONES = ["9800002201", "9800002202"];

async function cleanup() {
  const users = await User.find({ phone: { $in: TEST_PHONES } }).select("_id");
  const userIds = users.map((u) => u._id);
  const profiles = await StaffProfile.find({ user_id: { $in: userIds } }).select("_id");
  const profileIds = profiles.map((p) => p._id);

  if (profileIds.length) {
    await LeaveRequest.deleteMany({ staff_id: { $in: profileIds } });
    await StaffProfile.deleteMany({ _id: { $in: profileIds } });
  }
  if (userIds.length) {
    await User.deleteMany({ _id: { $in: userIds } });
  }
}

async function createTestStaff({ phone, name, designation, roleId }) {
  const user = await User.create({
    name,
    phone,
    email: `${phone}@leave-swap-blackout.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: roleId,
    is_active: true,
  });

  return StaffProfile.create({
    user_id: user._id,
    designation,
    weekly_off_day: 2,
    is_active: true,
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — swapLeave blackout blocked\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const staffA = await createTestStaff({
    phone: TEST_PHONES[0],
    name: "Swap Blackout A",
    designation: "Stylist",
    roleId: role._id,
  });
  const staffB = await createTestStaff({
    phone: TEST_PHONES[1],
    name: "Swap Blackout B",
    designation: "Beautician",
    roleId: role._id,
  });

  const monday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  const saturday = normalize(new Date("2026-08-15T12:00:00.000Z"));

  const leaveA = await LeaveRequest.create({
    staff_id: staffA._id,
    date: monday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Blackout swap fixture A",
  });
  const leaveB = await LeaveRequest.create({
    staff_id: staffB._id,
    date: saturday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Blackout swap fixture B",
  });

  const result = await swapLeave({
    staffIdA: staffA._id,
    dateA: monday,
    staffIdB: staffB._id,
    dateB: saturday,
    approvedBy: new mongoose.Types.ObjectId(),
  });

  if (result.success) {
    throw new Error("Expected swap into Saturday to fail, but success:true");
  }
  console.log(`  PASS: swap blocked — ${result.reason}`);

  const stillA = await LeaveRequest.findById(leaveA._id);
  const stillB = await LeaveRequest.findById(leaveB._id);
  if (!stillA || stillA.date.getTime() !== monday.getTime()) {
    throw new Error("Staff A Monday leave should be unchanged");
  }
  if (!stillB || stillB.date.getTime() !== saturday.getTime()) {
    throw new Error("Staff B Saturday leave should be unchanged");
  }
  console.log("  PASS: no leave records modified");

  await cleanup();
  console.log("\n[test] Blackout swap blocked passed");
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
