/**
 * Leave Stage 7 test (tracker row 36):
 * Full leave happy path — request → approve → Attendance on_leave;
 * clash reject; swap ok.
 *
 * Usage:
 *   npm run test:leave-happy-path
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import leaveRoutes from "../routes/leaveRoutes.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { normalize } from "../services/leaveClashService.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const STAFF_A_PHONE = "9800003601";
const STAFF_B_PHONE = "9800003602";
const STAFF_C_PHONE = "9800003603";
const MANAGER_PHONE = "9800003604";

async function cleanup() {
  for (const phone of [STAFF_A_PHONE, STAFF_B_PHONE, STAFF_C_PHONE, MANAGER_PHONE]) {
    const user = await User.findOne({ phone }).select("_id");
    if (!user) continue;

    const profile = await StaffProfile.findOne({ user_id: user._id }).select("_id");
    if (profile) {
      await LeaveRequest.deleteMany({ staff_id: profile._id });
      await Attendance.deleteMany({ staff_id: profile._id });
      await StaffProfile.deleteOne({ _id: profile._id });
    }
    await User.deleteOne({ _id: user._id });
  }
}

async function dispatchRoute({ method, url, token, body }) {
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

    const [path, queryString] = url.split("?");
    const query = {};
    if (queryString) {
      for (const part of queryString.split("&")) {
        const [key, value] = part.split("=");
        query[key] = decodeURIComponent(value || "");
      }
    }

    leaveRoutes.handle(
      {
        method,
        url: path,
        query,
        headers: { authorization: `Bearer ${token}` },
        body,
      },
      mockRes,
      (err) => {
        resolve({ statusCode: err?.statusCode || 500, data: null, err });
      }
    );
  });
}

async function createUserWithStaff({ phone, name, designation, roleId }) {
  const user = await User.create({
    name,
    phone,
    email: `${phone}@leave-happy-path.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: roleId,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation,
    weekly_off_day: 2,
    is_active: true,
  });

  return { user, staff, token: signAccessToken({ sub: user._id }) };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — full leave happy path\n");

  await cleanup();

  const stylistRole =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  const managerRole =
    (await Role.findOne({ name: ROLE_NAMES.MANAGER })) ||
    (await Role.findOne({ name: ROLE_NAMES.OWNER })) ||
    stylistRole;
  if (!stylistRole) throw new Error("No role found — run seed:roles first");

  const staffA = await createUserWithStaff({
    phone: STAFF_A_PHONE,
    name: "Happy Path Staff A",
    designation: "Stylist",
    roleId: stylistRole._id,
  });
  const staffB = await createUserWithStaff({
    phone: STAFF_B_PHONE,
    name: "Happy Path Staff B",
    designation: "Stylist",
    roleId: stylistRole._id,
  });
  const staffC = await createUserWithStaff({
    phone: STAFF_C_PHONE,
    name: "Happy Path Staff C",
    designation: "Beautician",
    roleId: stylistRole._id,
  });
  const manager = await createUserWithStaff({
    phone: MANAGER_PHONE,
    name: "Happy Path Manager",
    designation: "Manager",
    roleId: managerRole._id,
  });

  const tuesday = "2026-08-12";
  const saturday = "2026-08-15";
  const monday = normalize(new Date("2026-08-11T12:00:00.000Z"));
  const wednesday = normalize(new Date("2026-08-13T12:00:00.000Z"));

  // 1) Request → approve → Attendance on_leave
  const requested = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: staffA.token,
    body: { date: tuesday, leave_type: "weekly_off", reason: "Happy path request" },
  });
  if (!requested.data?.success || requested.statusCode !== 201) {
    throw new Error(`Request failed: ${requested.statusCode}`);
  }
  const leaveId = requested.data.data.id;

  const approved = await dispatchRoute({
    method: "POST",
    url: `/${leaveId}/approve`,
    token: manager.token,
  });
  if (!approved.data?.success || approved.data.data.status !== "approved") {
    throw new Error("Approve failed");
  }

  const attendance = await Attendance.findOne({
    staff_id: staffA.staff._id,
    date: normalize(new Date(tuesday)),
  });
  if (!attendance || attendance.status !== "on_leave") {
    throw new Error("Expected Attendance on_leave after approve");
  }
  console.log("  PASS: request → approve → Attendance on_leave");

  // 2) Clash reject (blackout Saturday)
  const clash = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: staffA.token,
    body: { date: saturday, leave_type: "extra_leave" },
  });
  if (clash.data?.success || clash.statusCode === 201) {
    throw new Error("Expected Saturday leave request to be rejected");
  }
  if (clash.err?.statusCode !== 400) {
    throw new Error(`Expected 400 clash reject, got ${clash.err?.statusCode}`);
  }
  console.log("  PASS: clash reject on blackout date");

  // 3) Swap ok (different designations, pre-approved Mon/Wed fixtures)
  await LeaveRequest.create({
    staff_id: staffB.staff._id,
    date: monday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Swap fixture B",
  });
  await LeaveRequest.create({
    staff_id: staffC.staff._id,
    date: wednesday,
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "Swap fixture C",
  });

  const swapped = await dispatchRoute({
    method: "POST",
    url: "/swap",
    token: manager.token,
    body: {
      staff_id_a: staffB.staff._id,
      date_a: monday.toISOString(),
      staff_id_b: staffC.staff._id,
      date_b: wednesday.toISOString(),
    },
  });
  if (!swapped.data?.success) {
    throw new Error(`Swap failed: ${swapped.err?.message || JSON.stringify(swapped.data)}`);
  }

  const attendanceB = await Attendance.findOne({ staff_id: staffB.staff._id, date: wednesday });
  const attendanceC = await Attendance.findOne({ staff_id: staffC.staff._id, date: monday });
  if (!attendanceB || attendanceB.status !== "on_leave") {
    throw new Error("Expected staff B on_leave on Wednesday after swap");
  }
  if (!attendanceC || attendanceC.status !== "on_leave") {
    throw new Error("Expected staff C on_leave on Monday after swap");
  }
  console.log("  PASS: swap ok with Attendance synced both sides");

  // 4) List leaves for August calendar view
  const listed = await dispatchRoute({
    method: "GET",
    url: "/?staff_id=" + staffA.staff._id + "&month=2026-08",
    token: manager.token,
  });
  if (!listed.data?.success || listed.data.data.leaves.length < 1) {
    throw new Error("Expected at least one leave in August list for staff A");
  }
  console.log("  PASS: GET list returns approved leave for calendar month");

  await cleanup();
  console.log("\n[test] Full leave happy path passed");
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
