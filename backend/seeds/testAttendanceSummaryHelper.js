/**
 * Payroll Stage B test (tracker row 9):
 * Export getMonthlyAttendanceSummary helper — callable by route + payroll.
 *
 * Usage:
 *   npm run test:attendance-summary-helper
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/ShiftMaster.js";
import "../models/Attendance.js";
import StaffProfile from "../models/StaffProfile.js";
import { getMonthlyAttendanceSummary } from "../services/attendanceSummaryService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — getMonthlyAttendanceSummary helper\n");

  if (typeof getMonthlyAttendanceSummary !== "function") {
    throw new Error("getMonthlyAttendanceSummary is not exported as a function");
  }
  console.log("  PASS: getMonthlyAttendanceSummary is exported");

  const year = 2026;
  const month = 8;

  const staff = await StaffProfile.findOne({ is_active: true }).select("_id");
  const summary = await getMonthlyAttendanceSummary({
    year,
    month,
    staffId: staff?._id || null,
  });

  if (summary.year !== year || summary.month !== month) {
    throw new Error("Expected year/month echoed in summary");
  }
  if (typeof summary.total_days_in_month !== "number") {
    throw new Error("Expected total_days_in_month");
  }
  if (!Array.isArray(summary.payroll_summaries)) {
    throw new Error("Expected payroll_summaries array");
  }
  console.log(
    `  PASS: helper returned ${summary.payroll_summaries.length} staff summar(ies) for ${month}/${year}`
  );

  console.log("\n[test] getMonthlyAttendanceSummary helper passed");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[test] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
