/**
 * Leave Stage 3 test (tracker row 14):
 * - Second Beautician same Tuesday → allowed:false
 * - Stylist same Tuesday → allowed:true
 * - Any designation on Saturday → allowed:false
 *
 * Usage:
 *   npm run test:leave-clash
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { checkClash, normalize } from "../services/leaveClashService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONES = ["9800001401", "9800001402", "9800001403"];

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
    email: `${phone}@leave-clash.test`,
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

async function assertAllowed(result, expected, label) {
  if (result.allowed !== expected) {
    throw new Error(
      `${label}: expected allowed=${expected}, got allowed=${result.allowed}` +
        (result.reason ? ` (${result.reason})` : "")
    );
  }
  console.log(`  PASS: ${label} → allowed=${result.allowed}`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — checkClash Beautician / blackout\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const beauticianA = await createTestStaff({
    phone: TEST_PHONES[0],
    name: "Clash Beautician A",
    designation: "Beautician",
    roleId: role._id,
  });
  const beauticianB = await createTestStaff({
    phone: TEST_PHONES[1],
    name: "Clash Beautician B",
    designation: "Beautician",
    roleId: role._id,
  });
  const stylist = await createTestStaff({
    phone: TEST_PHONES[2],
    name: "Clash Stylist C",
    designation: "Stylist",
    roleId: role._id,
  });

  // Tuesday 11 Aug 2026 UTC
  const tuesday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  // Saturday 15 Aug 2026 UTC
  const saturday = normalize(new Date("2026-08-15T12:00:00.000Z"));

  await LeaveRequest.create({
    staff_id: beauticianA._id,
    date: tuesday,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: true,
    reason: "Stage 3 clash fixture",
  });

  const clashBeautician = await checkClash({
    staffId: beauticianB._id,
    date: tuesday,
  });
  await assertAllowed(clashBeautician, false, "Second Beautician same Tuesday");

  const stylistOk = await checkClash({
    staffId: stylist._id,
    date: tuesday,
  });
  await assertAllowed(stylistOk, true, "Stylist same Tuesday");

  const saturdayBlocked = await checkClash({
    staffId: stylist._id,
    date: saturday,
  });
  await assertAllowed(saturdayBlocked, false, "Any designation on Saturday");

  await cleanup();
  console.log("\n[test] Clash checks passed");
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
