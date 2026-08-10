/**
 * Payroll prerequisite gate (Sheet 02 tracker row 3):
 * Leave Stages 1-7 complete — LeaveRequest + is_paid + Attendance on_leave sync.
 *
 * Usage:
 *   npm run test:leave-stages-gate
 */
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import { calculateIsPaid, normalize } from "../services/leaveClashService.js";
import { syncAttendanceForLeave } from "../services/leaveAttendanceSyncService.js";
import { hashPassword } from "../services/userService.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import Role, { ROLE_NAMES } from "../models/Role.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const leaveTrackerCsv = path.join(
  repoRoot,
  "leave-payroll-implementation-tracker-csv",
  "01_Leave-Clash-Swap.csv"
);

const REQUIRED_FILES = [
  "backend/constants/leaveConstants.js",
  "backend/models/LeaveRequest.js",
  "backend/models/Attendance.js",
  "backend/services/leaveClashService.js",
  "backend/services/leaveSwapService.js",
  "backend/services/leaveAttendanceSyncService.js",
  "backend/services/leaveService.js",
  "backend/routes/leaveRoutes.js",
];

const TEST_PHONE = "9800003701";

function assertLeaveTrackerComplete() {
  const csv = fs.readFileSync(leaveTrackerCsv, "utf8");
  const pending = csv
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() && line.includes(",Not Started,"));
  if (pending.length) {
    throw new Error(`Sheet 01 still has ${pending.length} Not Started row(s)`);
  }
  console.log("  PASS: Sheet 01 Leave-Clash-Swap has no Not Started rows");
}

function assertRequiredFiles() {
  for (const rel of REQUIRED_FILES) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) {
      throw new Error(`Missing required Leave Stage file: ${rel}`);
    }
  }
  console.log("  PASS: Leave Stage 1-7 backend files present");
}

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

async function assertLeavePaidAndAttendanceSync() {
  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Leave Gate Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@leave-stages-gate.test`,
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
  const isPaid = await calculateIsPaid({ staffId: staff._id, date: tuesday });
  if (isPaid !== true) {
    throw new Error("Expected calculateIsPaid true for first leave in week");
  }
  console.log("  PASS: calculateIsPaid (is_paid) working");

  const leave = await LeaveRequest.create({
    staff_id: staff._id,
    date: tuesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Gate fixture",
  });

  await syncAttendanceForLeave(leave);

  const attendance = await Attendance.findOne({
    staff_id: staff._id,
    date: tuesday,
  });
  if (!attendance || attendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave after sync");
  }
  if (String(attendance.leave_request_id) !== String(leave._id)) {
    throw new Error("Expected leave_request_id linked on Attendance");
  }
  console.log("  PASS: LeaveRequest + Attendance on_leave sync working");

  await cleanup();
}

function runHappyPath() {
  const result = spawnSync(process.execPath, ["seeds/testLeaveHappyPath.js"], {
    cwd: path.join(repoRoot, "backend"),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("testLeaveHappyPath.js failed — Leave Stage 7 API gate not met");
  }
  console.log("  PASS: full leave API happy path (Stage 7)");
}

async function main() {
  console.log("[test] Leave Stages 1-7 prerequisite gate\n");

  assertRequiredFiles();
  assertLeaveTrackerComplete();

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  await assertLeavePaidAndAttendanceSync();
  await mongoose.disconnect();

  runHappyPath();

  console.log("\n[test] Payroll gate passed — safe to start Sheet 02 Stage A");
}

main().catch(async (error) => {
  console.error("[test] Gate failed:", error.message);
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
