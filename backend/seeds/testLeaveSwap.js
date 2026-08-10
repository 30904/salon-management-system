/**
 * Leave Stage 5 test (tracker row 21):
 * Valid Mon↔Wed swap between two staff (different designations) → success:true;
 * both records swapped_off approved.
 *
 * Usage:
 *   npm run test:leave-swap
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

const TEST_PHONES = ["9800002101", "9800002102"];

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
    email: `${phone}@leave-swap.test`,
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
  console.log("[test] Connected — swapLeave valid Mon↔Wed\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const approverId = new mongoose.Types.ObjectId();

  // Different designations so no clash when swapping into each other's dates
  const staffA = await createTestStaff({
    phone: TEST_PHONES[0],
    name: "Swap Staff A",
    designation: "Stylist",
    roleId: role._id,
  });
  const staffB = await createTestStaff({
    phone: TEST_PHONES[1],
    name: "Swap Staff B",
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
    reason: "Swap fixture A",
  });
  await LeaveRequest.create({
    staff_id: staffB._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Swap fixture B",
  });

  const result = await swapLeave({
    staffIdA: staffA._id,
    dateA: monday,
    staffIdB: staffB._id,
    dateB: wednesday,
    approvedBy: approverId,
  });

  if (!result.success) {
    throw new Error(`Expected swap success, got: ${result.reason || "unknown"}`);
  }
  console.log("  PASS: swapLeave returned success:true");

  const afterA = await LeaveRequest.findOne({ staff_id: staffA._id, date: wednesday });
  const afterB = await LeaveRequest.findOne({ staff_id: staffB._id, date: monday });

  if (!afterA || afterA.leave_type !== "swapped_off" || afterA.status !== "approved") {
    throw new Error("Staff A should have approved swapped_off on Wednesday");
  }
  if (!afterB || afterB.leave_type !== "swapped_off" || afterB.status !== "approved") {
    throw new Error("Staff B should have approved swapped_off on Monday");
  }

  const oldA = await LeaveRequest.findOne({ staff_id: staffA._id, date: monday });
  const oldB = await LeaveRequest.findOne({ staff_id: staffB._id, date: wednesday });
  if (oldA || oldB) {
    throw new Error("Old leave records should have been removed");
  }

  console.log("  PASS: both records swapped_off approved");
  console.log(`  PASS: A now off ${wednesday.toISOString().slice(0, 10)}`);
  console.log(`  PASS: B now off ${monday.toISOString().slice(0, 10)}`);

  await cleanup();
  console.log("\n[test] Valid swap passed");
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
