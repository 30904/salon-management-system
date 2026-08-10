/**
 * Payroll Stage B test (tracker row 10):
 * Populate leave_request_id on summary query — is_paid without N+1.
 *
 * Usage:
 *   npm run test:attendance-summary-leave-populate
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
import LeaveRequest from "../models/LeaveRequest.js";
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

const TEST_PHONE = "9800001010";
const LEAVE_DATE = new Date(Date.UTC(2026, 7, 12)); // Wed 12 Aug 2026

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
  console.log("[test] Connected — populate leave_request_id on summary\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Summary Leave Populate Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@summary-leave-populate.test`,
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

  const leave = await LeaveRequest.create({
    staff_id: staff._id,
    date: LEAVE_DATE,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: false,
    reason: "Populate test unpaid leave",
  });

  await Attendance.create({
    staff_id: staff._id,
    date: LEAVE_DATE,
    status: "on_leave",
    remarks: "Unpaid leave",
    leave_request_id: leave._id,
  });

  const summary = await getMonthlyAttendanceSummary({
    year: 2026,
    month: 8,
    staffId: staff._id,
  });

  const staffSummary = summary.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!staffSummary) throw new Error("Expected staff summary row");

  const leaveRec = staffSummary.records.find(
    (r) => r.status === "on_leave" && String(r.leave_request_id) === String(leave._id)
  );
  if (!leaveRec) throw new Error("Expected on_leave record with leave_request_id");

  if (!leaveRec.leave_request || leaveRec.leave_request.is_paid !== false) {
    throw new Error(
      `Expected populated leave_request.is_paid=false, got ${JSON.stringify(leaveRec.leave_request)}`
    );
  }
  console.log("  PASS: leave_request_id populated with is_paid on summary records");

  // Confirm mongoose doc path also has populated ref (no N+1 needed later)
  const raw = await Attendance.findOne({ staff_id: staff._id, date: LEAVE_DATE }).populate(
    "leave_request_id",
    "is_paid leave_type status date"
  );
  if (raw.leave_request_id?.is_paid !== false) {
    throw new Error("Expected leave_request_id.is_paid accessible on populated doc");
  }
  console.log("  PASS: leave_request_id.is_paid available on Attendance without extra query");

  await cleanup();
  console.log("\n[test] Summary leave_request populate passed");
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
