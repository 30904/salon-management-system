/**
 * UAT (tracker sheet 03 row 15):
 * Leave blackout never allows Fri/Sat/Sun — all leave/swap paths return blocked.
 *
 * Usage:
 *   npm run test:uat-leave-blackout
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
import { isBlackoutDate } from "../constants/leaveConstants.js";
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
  requester: "9800001511",
  swapA: "9800001512",
  swapB: "9800001513",
};

const BLACKOUT_DATES = {
  fri: "2026-08-14",
  sat: "2026-08-15",
  sun: "2026-08-16",
};

const MONDAY = "2026-08-17";

async function cleanup() {
  const phones = Object.values(PHONES);
  const users = await User.find({ phone: { $in: phones } }).select("_id");
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

async function createTestStaff({ phone, name, designation, roleId }) {
  const user = await User.create({
    name,
    phone,
    email: `${phone}@uat-leave-blackout.test`,
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

  return { user, staff };
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

async function assertCreateBlocked(staffId, date, label) {
  try {
    await createLeaveRequest({
      staffId,
      date,
      leaveType: "extra_leave",
      reason: "UAT blackout",
    });
    throw new Error(`${label}: createLeaveRequest unexpectedly succeeded`);
  } catch (error) {
    if (error.message?.includes("unexpectedly succeeded")) throw error;
    if (!(error instanceof AppError) || error.statusCode !== 400) {
      throw new Error(`${label}: expected AppError 400, got ${error.message}`);
    }
    console.log(`  PASS: ${label} → ${error.message}`);
  }
}

async function assertWeeklyOffRejected(value, label) {
  const doc = new StaffProfile({
    user_id: new mongoose.Types.ObjectId(),
    designation: "UAT Stylist",
    weekly_off_day: value,
  });

  try {
    await doc.validate();
    throw new Error(`${label}: weekly_off_day=${value} unexpectedly accepted`);
  } catch (error) {
    if (error.message?.includes("unexpectedly accepted")) throw error;
    if (!error.errors?.weekly_off_day) throw error;
    console.log(`  PASS: ${label} rejected`);
  }
}

async function main() {
  console.log("[test] UAT — Fri/Sat/Sun blackout on all leave/swap paths\n");

  for (const [label, iso] of Object.entries(BLACKOUT_DATES)) {
    const date = normalize(iso);
    if (!isBlackoutDate(date)) {
      throw new Error(`isBlackoutDate(${iso} ${label}) should be true`);
    }
  }
  if (isBlackoutDate(normalize(MONDAY))) {
    throw new Error("Monday must not be a blackout date");
  }
  console.log("  PASS: isBlackoutDate Fri/Sat/Sun true, Monday false");

  await assertWeeklyOffRejected(5, "weekly_off_day=Fri");
  await assertWeeklyOffRejected(6, "weekly_off_day=Sat");
  await assertWeeklyOffRejected(0, "weekly_off_day=Sun");

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("\n[test] Connected — leave/swap blackout UAT\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const { user: requester, staff } = await createTestStaff({
    phone: PHONES.requester,
    name: "UAT Blackout Requester",
    designation: "Stylist",
    roleId: role._id,
  });
  const { staff: staffA } = await createTestStaff({
    phone: PHONES.swapA,
    name: "UAT Blackout Swap A",
    designation: "Stylist",
    roleId: role._id,
  });
  const { staff: staffB } = await createTestStaff({
    phone: PHONES.swapB,
    name: "UAT Blackout Swap B",
    designation: "Beautician",
    roleId: role._id,
  });

  const token = signAccessToken({ sub: requester._id });
  const monday = normalize(MONDAY);

  for (const [label, iso] of Object.entries(BLACKOUT_DATES)) {
    const clash = await checkClash({ staffId: staff._id, date: iso });
    if (clash.allowed) {
      throw new Error(`checkClash ${label} ${iso} should be blocked`);
    }
    console.log(`  PASS: checkClash ${label} blocked — ${clash.reason}`);

    await assertCreateBlocked(staff._id, iso, `createLeaveRequest ${label}`);

    const requestRes = await dispatchRoute({
      method: "POST",
      url: "/request",
      token,
      body: { date: iso, leave_type: "weekly_off", reason: "UAT blackout" },
    });
    assertBlockedHttp(requestRes, `POST /leave/request ${label}`);

    await LeaveRequest.deleteMany({ staff_id: { $in: [staffA._id, staffB._id] } });
    const leaveA = await LeaveRequest.create({
      staff_id: staffA._id,
      date: monday,
      leave_type: "weekly_off",
      status: "approved",
      is_paid: true,
      reason: "UAT swap fixture A",
    });
    const leaveB = await LeaveRequest.create({
      staff_id: staffB._id,
      date: normalize(iso),
      leave_type: "weekly_off",
      status: "approved",
      is_paid: true,
      reason: "UAT swap fixture B",
    });

    const swapResult = await swapLeave({
      staffIdA: staffA._id,
      dateA: monday,
      staffIdB: staffB._id,
      dateB: iso,
      approvedBy: requester._id,
    });
    if (swapResult.success) {
      throw new Error(`swapLeave ${label} unexpectedly succeeded`);
    }
    console.log(`  PASS: swapLeave ${label} blocked — ${swapResult.reason}`);

    const stillA = await LeaveRequest.findById(leaveA._id);
    const stillB = await LeaveRequest.findById(leaveB._id);
    if (!stillA || stillA.date.getTime() !== monday.getTime()) {
      throw new Error(`swapLeave ${label} mutated staff A leave`);
    }
    if (!stillB || stillB.date.getTime() !== normalize(iso).getTime()) {
      throw new Error(`swapLeave ${label} mutated staff B leave`);
    }

    const swapApi = await dispatchRoute({
      method: "POST",
      url: "/swap",
      token,
      body: {
        staff_id_a: staffA._id,
        date_a: monday.toISOString(),
        staff_id_b: staffB._id,
        date_b: iso,
      },
    });
    assertBlockedHttp(swapApi, `POST /leave/swap ${label}`);
  }

  await cleanup();
  console.log("\n[test] UAT leave blackout Fri/Sat/Sun passed");
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
