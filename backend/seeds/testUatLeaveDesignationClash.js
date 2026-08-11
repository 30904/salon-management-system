/**
 * UAT (tracker sheet 03 row 16):
 * Two Beauticians cannot both be approved off the same Mon–Thu date.
 *
 * Usage:
 *   npm run test:uat-leave-designation-clash
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import leaveRoutes from "../routes/leaveRoutes.js";
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import { checkClash, normalize } from "../services/leaveClashService.js";
import { createLeaveRequest } from "../services/leaveService.js";
import { swapLeave } from "../services/leaveSwapService.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const PHONES = {
  beauticianA: "9800001611",
  beauticianB: "9800001612",
  beauticianC: "9800001615",
  stylist: "9800001613",
  manager: "9800001614",
};

const TUESDAY = "2026-08-11";
const THURSDAY = "2026-08-13";

async function cleanup() {
  const users = await User.find({ phone: { $in: Object.values(PHONES) } }).select("_id");
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

    leaveRoutes.handle(
      {
        method,
        url,
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

function assertBlockedHttp(result, label) {
  if (result.data?.success) {
    throw new Error(`${label}: expected blocked, got success`);
  }
  const status = result.err?.statusCode || result.statusCode;
  if (status !== 400) {
    throw new Error(
      `${label}: expected 400, got ${status}: ${result.err?.message || JSON.stringify(result.data)}`
    );
  }
  console.log(`  PASS: ${label} → 400`);
}

async function createTestUser({ phone, name, designation, roleId, withProfile = true }) {
  const user = await User.create({
    name,
    phone,
    email: `${phone}@uat-leave-clash.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: roleId,
    is_active: true,
  });

  if (!withProfile) {
    return { user, staff: null };
  }

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation,
    weekly_off_day: 2,
    is_active: true,
  });

  return { user, staff };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] UAT — two Beauticians cannot both be approved off same date\n");

  await cleanup();

  const stylistRole =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  const managerRole =
    (await Role.findOne({ name: ROLE_NAMES.MANAGER })) ||
    (await Role.findOne({ name: ROLE_NAMES.OWNER })) ||
    stylistRole;
  if (!stylistRole) throw new Error("No role found — run seed:roles first");

  const { user: userA, staff: beauticianA } = await createTestUser({
    phone: PHONES.beauticianA,
    name: "UAT Clash Beautician A",
    designation: "Beautician",
    roleId: stylistRole._id,
  });
  const { user: userB, staff: beauticianB } = await createTestUser({
    phone: PHONES.beauticianB,
    name: "UAT Clash Beautician B",
    designation: "Beautician",
    roleId: stylistRole._id,
  });
  const { staff: beauticianC } = await createTestUser({
    phone: PHONES.beauticianC,
    name: "UAT Clash Beautician C",
    designation: "Beautician",
    roleId: stylistRole._id,
  });
  const { user: stylistUser, staff: stylist } = await createTestUser({
    phone: PHONES.stylist,
    name: "UAT Clash Stylist",
    designation: "Stylist",
    roleId: stylistRole._id,
  });
  const { user: manager } = await createTestUser({
    phone: PHONES.manager,
    name: "UAT Clash Manager",
    roleId: managerRole._id,
    withProfile: false,
  });

  const tokenA = signAccessToken({ sub: userA._id });
  const tokenB = signAccessToken({ sub: userB._id });
  const tokenStylist = signAccessToken({ sub: stylistUser._id });
  const tokenManager = signAccessToken({ sub: manager._id });
  const tuesday = normalize(TUESDAY);

  const requestA = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: tokenA,
    body: { date: TUESDAY, leave_type: "weekly_off", reason: "UAT A" },
  });
  if (!requestA.data?.success || requestA.statusCode !== 201) {
    throw new Error(`Expected A request 201, got ${requestA.statusCode}: ${JSON.stringify(requestA.data)}`);
  }

  const approveA = await dispatchRoute({
    method: "POST",
    url: `/${requestA.data.data.id}/approve`,
    token: tokenManager,
  });
  if (!approveA.data?.success || approveA.data.data.status !== "approved") {
    throw new Error(`Expected A approve success, got ${approveA.statusCode}: ${JSON.stringify(approveA.data || approveA.err?.message)}`);
  }
  console.log("  PASS: first Beautician approved off Tuesday");

  const clashB = await checkClash({ staffId: beauticianB._id, date: TUESDAY });
  if (clashB.allowed) {
    throw new Error("Expected checkClash to block second Beautician on Tuesday");
  }
  if (!clashB.reason?.includes("Beautician")) {
    throw new Error(`Expected Beautician clash reason, got: ${clashB.reason}`);
  }
  console.log(`  PASS: checkClash blocks second Beautician — ${clashB.reason}`);

  try {
    await createLeaveRequest({
      staffId: beauticianB._id,
      date: TUESDAY,
      leaveType: "extra_leave",
      reason: "UAT B service",
    });
    throw new Error("createLeaveRequest B unexpectedly succeeded");
  } catch (error) {
    if (error.message?.includes("unexpectedly succeeded")) throw error;
    if (!(error instanceof AppError) || error.statusCode !== 400) {
      throw new Error(`Expected AppError 400 for B request, got ${error.message}`);
    }
    console.log("  PASS: createLeaveRequest blocks second Beautician");
  }

  const requestB = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: tokenB,
    body: { date: TUESDAY, leave_type: "weekly_off", reason: "UAT B" },
  });
  assertBlockedHttp(requestB, "POST /leave/request second Beautician");

  const requestStylist = await dispatchRoute({
    method: "POST",
    url: "/request",
    token: tokenStylist,
    body: { date: TUESDAY, leave_type: "weekly_off", reason: "UAT stylist" },
  });
  if (!requestStylist.data?.success || requestStylist.statusCode !== 201) {
    throw new Error(
      `Expected stylist request allowed, got ${requestStylist.statusCode}: ${JSON.stringify(requestStylist.data || requestStylist.err?.message)}`
    );
  }
  const approveStylist = await dispatchRoute({
    method: "POST",
    url: `/${requestStylist.data.data.id}/approve`,
    token: tokenManager,
  });
  if (!approveStylist.data?.success) {
    throw new Error(
      `Expected stylist approve allowed, got ${approveStylist.statusCode}: ${JSON.stringify(approveStylist.data || approveStylist.err?.message)}`
    );
  }
  console.log("  PASS: Stylist can still be approved off the same Tuesday");

  await LeaveRequest.deleteMany({ staff_id: beauticianB._id });
  const pendingB = await LeaveRequest.create({
    staff_id: beauticianB._id,
    date: tuesday,
    leave_type: "extra_leave",
    status: "pending",
    is_paid: true,
    reason: "UAT race pending",
  });
  const approveRace = await dispatchRoute({
    method: "POST",
    url: `/${pendingB._id}/approve`,
    token: tokenManager,
  });
  assertBlockedHttp(approveRace, "POST /leave/:id/approve second Beautician");

  const stillPending = await LeaveRequest.findById(pendingB._id);
  if (!stillPending || stillPending.status !== "pending") {
    throw new Error("Second Beautician leave must stay pending after clash approve");
  }
  console.log("  PASS: raced pending approve does not create a second approved Beautician");

  await LeaveRequest.deleteMany({ staff_id: { $in: [beauticianB._id, stylist._id] } });
  await LeaveRequest.create({
    staff_id: beauticianB._id,
    date: normalize(THURSDAY),
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "UAT swap B Thursday",
  });
  await LeaveRequest.create({
    staff_id: beauticianC._id,
    date: normalize(THURSDAY),
    leave_type: "weekly_off",
    status: "approved",
    is_paid: true,
    reason: "UAT swap C still on Thursday",
  });

  const swapResult = await swapLeave({
    staffIdA: beauticianA._id,
    dateA: tuesday,
    staffIdB: beauticianB._id,
    dateB: normalize(THURSDAY),
    approvedBy: manager._id,
  });
  if (swapResult.success) {
    throw new Error("Expected swap onto Thursday to fail while another Beautician stays off that day");
  }
  if (!swapResult.reason?.includes("Beautician")) {
    throw new Error(`Expected Beautician swap clash, got: ${swapResult.reason}`);
  }
  console.log(`  PASS: swapLeave blocked — ${swapResult.reason}`);

  const approvedBeauticians = await LeaveRequest.countDocuments({
    staff_id: { $in: [beauticianA._id, beauticianB._id] },
    date: tuesday,
    status: "approved",
  });
  if (approvedBeauticians !== 1) {
    throw new Error(`Expected exactly 1 approved Beautician on Tuesday, got ${approvedBeauticians}`);
  }
  console.log("  PASS: only one Beautician remains approved off Tuesday");

  await cleanup();
  console.log("\n[test] UAT designation clash passed");
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
