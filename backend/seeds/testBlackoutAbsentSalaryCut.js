/**
 * Fri/Sat/Sun absence counts as 2 unpaid salary days; weekday absence = 1.
 * Leave blackout on those days is unchanged (still blocked).
 *
 * Usage:
 *   npm run test:blackout-absent-cut
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/ShiftMaster.js";
import "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { hashPassword } from "../services/userService.js";
import { unpaidDaysForAbsence, isBlackoutDate } from "../constants/leaveConstants.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";

dns.setDefaultResultOrder("ipv4first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9000008899";
const FRIDAY = new Date("2026-08-14T00:00:00.000Z");
const THURSDAY = new Date("2026-08-13T00:00:00.000Z");

async function cleanup() {
  const user = await User.findOne({ phone: TEST_PHONE });
  if (!user) return;
  const profile = await StaffProfile.findOne({ user_id: user._id });
  if (profile) {
    await Attendance.deleteMany({ staff_id: profile._id });
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — blackout absent salary cut\n");

  if (!isBlackoutDate(FRIDAY)) throw new Error("Expected Friday blackout");
  if (isBlackoutDate(THURSDAY)) throw new Error("Expected Thursday not blackout");
  if (unpaidDaysForAbsence(FRIDAY) !== 2) {
    throw new Error("Expected Friday absence weight 2");
  }
  if (unpaidDaysForAbsence(THURSDAY) !== 1) {
    throw new Error("Expected Thursday absence weight 1");
  }
  console.log("  PASS: unpaidDaysForAbsence Fri=2, Thu=1");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Blackout Absent Cut Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@blackout-absent.test`,
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

  await Attendance.create([
    { staff_id: staff._id, date: THURSDAY, status: "absent" },
    { staff_id: staff._id, date: FRIDAY, status: "absent" },
  ]);

  const summary = await getMonthlyAttendanceSummary({
    year: 2026,
    month: 8,
    staffId: staff._id,
  });
  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary");

  if (row.days_absent !== 2) {
    throw new Error(`Expected days_absent=2, got ${row.days_absent}`);
  }
  // Thu(1) + Fri(2) = 3 unpaid salary days
  if (row.unpaid_days !== 3) {
    throw new Error(`Expected unpaid_days=3 (1+2), got ${row.unpaid_days}`);
  }
  console.log("  PASS: unpaid_days=3 for Thu absent + Fri absent");

  await cleanup();
  console.log("\n[test] blackout absent salary cut passed");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message);
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
