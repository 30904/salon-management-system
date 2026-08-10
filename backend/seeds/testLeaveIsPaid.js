/**
 * Leave Stage 4 test (tracker row 18):
 * 1 approved leave this week → 2nd date same week is_paid false; next week true.
 *
 * Usage:
 *   npm run test:leave-is-paid
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { calculateIsPaid, normalize } from "../services/leaveClashService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001801";

async function cleanup() {
  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await LeaveRequest.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function assertPaid(result, expected, label) {
  if (result !== expected) {
    throw new Error(`${label}: expected is_paid=${expected}, got ${result}`);
  }
  console.log(`  PASS: ${label} → is_paid=${result}`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — calculateIsPaid weekly rule\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "IsPaid Test Staff",
    phone: TEST_PHONE,
    email: "is-paid-test@s21.test",
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const profile = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    is_active: true,
  });

  // Mon 11 Aug 2026 and Wed 13 Aug 2026 — same Mon–Sun week
  const monday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  const wednesday = normalize(new Date("2026-08-13T12:00:00.000Z"));
  // Mon 18 Aug 2026 — next week
  const nextMonday = normalize(new Date("2026-08-18T12:00:00.000Z"));

  await assertPaid(
    await calculateIsPaid({ staffId: profile._id, date: monday }),
    true,
    "First leave day in week (no approved yet)"
  );

  await LeaveRequest.create({
    staff_id: profile._id,
    date: monday,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: true,
    reason: "Stage 4 is_paid fixture",
  });

  await assertPaid(
    await calculateIsPaid({ staffId: profile._id, date: wednesday }),
    false,
    "Second leave day same week"
  );

  await assertPaid(
    await calculateIsPaid({ staffId: profile._id, date: nextMonday }),
    true,
    "First leave day next week"
  );

  await cleanup();
  console.log("\n[test] calculateIsPaid checks passed");
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
