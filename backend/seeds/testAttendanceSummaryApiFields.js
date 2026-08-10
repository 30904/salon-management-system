/**
 * Payroll Stage B test (tracker row 15):
 * GET /api/attendance/summary returns new Stage B fields.
 *
 * Usage:
 *   npm run test:attendance-summary-api-fields
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
import "../models/Holiday.js";
import attendanceRoutes from "../routes/attendanceRoutes.js";
import Attendance from "../models/Attendance.js";
import Holiday from "../models/Holiday.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_PHONE = "9800001515";
const HOLIDAY_DATE = new Date(Date.UTC(2026, 7, 20));
const PRESENT_DATE = new Date(Date.UTC(2026, 7, 17));
const PAID_LEAVE_DATE = new Date(Date.UTC(2026, 7, 11));
const UNPAID_LEAVE_DATE = new Date(Date.UTC(2026, 7, 12));

const REQUIRED_FIELDS = [
  "working_days_in_month",
  "days_paid_leave",
  "days_unpaid_leave",
  "holiday_count",
  "payable_days",
  "unpaid_days",
];

async function cleanup() {
  await Holiday.deleteMany({ name: "Summary API Fields Holiday" });

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

async function dispatchRoute({ method, url, token, query }) {
  return new Promise((resolve) => {
    let responseData = null;
    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return mockRes;
      },
      json(data) {
        responseData = data;
        resolve({ statusCode, data });
        return mockRes;
      },
    };

    attendanceRoutes.handle(
      {
        method,
        url,
        query: query || {},
        headers: { authorization: `Bearer ${token}` },
      },
      mockRes,
      (err) => {
        resolve({ statusCode: err?.statusCode || 500, data: null, err });
      }
    );
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — GET /attendance/summary new fields\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Summary API Fields Test",
    phone: TEST_PHONE,
    email: `${TEST_PHONE}@summary-api-fields.test`,
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

  await Holiday.create({
    date: HOLIDAY_DATE,
    name: "Summary API Fields Holiday",
    branch_id: null,
    is_active: true,
  });

  const paidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: PAID_LEAVE_DATE,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
  });
  const unpaidLeave = await LeaveRequest.create({
    staff_id: staff._id,
    date: UNPAID_LEAVE_DATE,
    leave_type: "extra_leave",
    status: "approved",
    is_paid: false,
  });

  await Attendance.create([
    { staff_id: staff._id, date: PRESENT_DATE, status: "present" },
    {
      staff_id: staff._id,
      date: PAID_LEAVE_DATE,
      status: "on_leave",
      leave_request_id: paidLeave._id,
    },
    {
      staff_id: staff._id,
      date: UNPAID_LEAVE_DATE,
      status: "on_leave",
      leave_request_id: unpaidLeave._id,
    },
  ]);

  const token = signAccessToken({ sub: user._id });
  const response = await dispatchRoute({
    method: "GET",
    url: "/summary",
    token,
    query: { year: "2026", month: "8", staff_id: String(staff._id) },
  });

  if (!response.data?.success) {
    throw new Error(
      `Expected success response, got ${response.statusCode}: ${response.err?.message || JSON.stringify(response.data)}`
    );
  }

  const payload = response.data.data;
  if (!payload || !Array.isArray(payload.payroll_summaries)) {
    throw new Error("Expected payroll_summaries in GET /summary response");
  }

  const row = payload.payroll_summaries.find(
    (s) => String(s.staff_id) === String(staff._id)
  );
  if (!row) throw new Error("Expected staff summary in response");

  for (const field of REQUIRED_FIELDS) {
    if (row[field] === undefined || row[field] === null) {
      throw new Error(`Missing required summary field: ${field}`);
    }
  }
  console.log(`  PASS: GET /summary includes ${REQUIRED_FIELDS.join(", ")}`);

  // Sanity values for this fixture: 1 present + 1 paid leave + 1 holiday = payable 3; unpaid 1
  if (row.holiday_count !== 1) {
    throw new Error(`Expected holiday_count=1, got ${row.holiday_count}`);
  }
  if (row.days_paid_leave !== 1 || row.days_unpaid_leave !== 1) {
    throw new Error(
      `Expected paid=1 unpaid=1, got paid=${row.days_paid_leave} unpaid=${row.days_unpaid_leave}`
    );
  }
  if (row.working_days_in_month !== 30) {
    throw new Error(
      `Expected working_days_in_month=30 (31-1), got ${row.working_days_in_month}`
    );
  }
  if (row.payable_days !== 3) {
    throw new Error(`Expected payable_days=3, got ${row.payable_days}`);
  }
  if (row.unpaid_days !== 1) {
    throw new Error(`Expected unpaid_days=1, got ${row.unpaid_days}`);
  }
  console.log("  PASS: new field values match Stage B formulas");

  await cleanup();
  console.log("\n[test] GET /attendance/summary new fields passed");
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
