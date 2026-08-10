/**
 * Leave Stage 5 test (tracker row 23):
 * Swap into designation clash → success:false; no writes.
 *
 * A (Stylist) off Mon, B (Stylist) off Wed — but C (Stylist) also off Wed.
 * Swap A↔B fails because A cannot take Wed while C is still off.
 *
 * Usage:
 *   npm run test:leave-swap-clash
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

const TEST_PHONES = ["9800002301", "9800002302", "9800002303"];

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
    email: `${phone}@leave-swap-clash.test`,
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
  console.log("[test] Connected — swapLeave designation clash blocked\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const staffA = await createTestStaff({
    phone: TEST_PHONES[0],
    name: "Swap Clash A",
    designation: "Stylist",
    roleId: role._id,
  });
  const staffB = await createTestStaff({
    phone: TEST_PHONES[1],
    name: "Swap Clash B",
    designation: "Stylist",
    roleId: role._id,
  });
  const staffC = await createTestStaff({
    phone: TEST_PHONES[2],
    name: "Swap Clash C",
    designation: "Stylist",
    roleId: role._id,
  });

  const monday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  const wednesday = normalize(new Date("2026-08-13T12:00:00.000Z"));

  const leaveA = await LeaveRequest.create({
    staff_id: staffA._id,
    date: monday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Clash swap fixture A",
  });
  const leaveB = await LeaveRequest.create({
    staff_id: staffB._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Clash swap fixture B",
  });
  await LeaveRequest.create({
    staff_id: staffC._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Clash swap fixture C blocks A taking Wed",
  });

  const result = await swapLeave({
    staffIdA: staffA._id,
    dateA: monday,
    staffIdB: staffB._id,
    dateB: wednesday,
    approvedBy: new mongoose.Types.ObjectId(),
  });

  if (result.success) {
    throw new Error("Expected swap into designation clash to fail, but success:true");
  }
  if (!result.reason?.includes("Another Stylist")) {
    throw new Error(`Expected designation clash reason, got: ${result.reason}`);
  }
  console.log(`  PASS: swap blocked — ${result.reason}`);

  const stillA = await LeaveRequest.findById(leaveA._id);
  const stillB = await LeaveRequest.findById(leaveB._id);
  if (!stillA || stillA.date.getTime() !== monday.getTime()) {
    throw new Error("Staff A Monday leave should be unchanged");
  }
  if (!stillB || stillB.date.getTime() !== wednesday.getTime()) {
    throw new Error("Staff B Wednesday leave should be unchanged");
  }
  console.log("  PASS: no leave records modified");

  await cleanup();
  console.log("\n[test] Designation clash swap blocked passed");
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
