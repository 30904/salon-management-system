/**
 * Payroll Stage B test (tracker row 14):
 * workingDaysInMonth = totalDaysInMonth - holidayCount.
 *
 * Usage:
 *   npm run test:attendance-summary-working-days
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
import Holiday from "../models/Holiday.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001414";
const HOLIDAY_DATES = [
  new Date(Date.UTC(2026, 7, 15)),
  new Date(Date.UTC(2026, 7, 20)),
  new Date(Date.UTC(2026, 7, 25)),
];

async function cleanup() {
  await Holiday.deleteMany({ name: { $regex: /^Working Days Holiday Test/ } });

  const user = await User.findOne({ phone: TEST_PHONE }).select("_id");
  if (!user) return;

  const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
  if (profile) {
    await StaffProfile.deleteOne({ _id: profile._id });
  }
  await User.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — workingDaysInMonth\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Working Days Summary Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@working-days-summary.test`,
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

  await Holiday.create(
    HOLIDAY_DATES.map((date, i) => ({
      date,
      name: `Working Days Holiday Test ${i + 1}`,
      branch_id: null,
      is_active: true,
    }))
  );

  const year = 2026;
  const month = 8;
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); // 31
  const expectedWorking = totalDaysInMonth - HOLIDAY_DATES.length; // 28

  const summary = await getMonthlyAttendanceSummary({
    year,
    month,
    staffId: staff._id,
  });

  if (summary.total_days_in_month !== totalDaysInMonth) {
    throw new Error(
      `Expected total_days_in_month=${totalDaysInMonth}, got ${summary.total_days_in_month}`
    );
  }

  const row = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary");

  if (row.holiday_count !== 3) {
    throw new Error(`Expected holiday_count=3, got ${row.holiday_count}`);
  }
  if (row.working_days_in_month !== expectedWorking) {
    throw new Error(
      `Expected working_days_in_month=${expectedWorking}, got ${row.working_days_in_month}`
    );
  }
  console.log(
    `  PASS: working_days_in_month = ${totalDaysInMonth} - 3 = ${expectedWorking}`
  );

  await cleanup();
  console.log("\n[test] workingDaysInMonth passed");
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
