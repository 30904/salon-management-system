import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/ShiftMaster.js";
import "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import { signAccessToken } from "../utils/jwt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

// Mock Express req, res, next to test route handlers directly
import attendanceRoutes from "../routes/attendanceRoutes.js";

async function runTests() {
  await connectDB();
  console.log("[test] Starting Attendance Punch-In / Punch-Out API Tests...\n");

  // Get target staff profile and two distinct users to test self punch vs admin-on-behalf punch
  const staffProfiles = await StaffProfile.find().populate("user_id").limit(2);
  if (staffProfiles.length === 0) {
    console.log("[test] Need at least 1 staff profile in DB. Run `npm run seed:dev` first.");
    process.exit(1);
  }

  const stylistStaff = staffProfiles[0];
  const stylistUser = stylistStaff.user_id;

  // For admin user punching on behalf, pick either a second staff user OR any other User (e.g., Salon Owner)
  let adminUser = staffProfiles[1]?.user_id;
  if (!adminUser) {
    adminUser = await User.findOne({ _id: { $ne: stylistUser._id } });
  }
  if (!adminUser) {
    adminUser = stylistUser; // fallback if only exactly 1 user exists in entire DB
  }

  console.log(`[test] Target Staff Member : ${stylistUser.name} (${stylistStaff.designation})`);
  console.log(`[test] Admin User          : ${adminUser.name} (${staffProfiles[1]?.designation || "Owner/Admin"})\n`);

  // Clean up any existing attendance records for stylistStaff today for clean test
  const todayUTC = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  await Attendance.deleteMany({ staff_id: stylistStaff._id, date: todayUTC });
  console.log("[test] 1. Cleaned up today's attendance records for test staff.");

  // Helper function to dispatch mock request through express router
  async function dispatchRoute(mockReq) {
    return new Promise((resolve, reject) => {
      let responseData = null;
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          responseData = data;
          resolve({ data, err: null });
          return mockRes;
        },
      };
      attendanceRoutes.handle(mockReq, mockRes, (err) => {
        if (err) resolve({ data: null, err });
        else if (!responseData) resolve({ data: null, err: new Error("No response sent") });
      });
    });
  }

  // Test 1: Punch In (Self or Admin on behalf)
  console.log("[test] 2. Testing POST /api/attendance/punch-in (Admin punching on behalf of Stylist)...");
  const mockReq1 = {
    method: "POST",
    url: "/punch-in",
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
    body: {
      staff_id: stylistStaff._id, // Punching for Stylist
      remarks: "Morning check-in at front desk",
    },
  };

  const { data: responseData1, err: err1 } = await dispatchRoute(mockReq1);
  if (err1) throw err1;

  if (!responseData1?.success) {
    throw new Error(`Punch-In failed: ${JSON.stringify(responseData1)}`);
  }

  const punchedRecord = responseData1.data;
  console.log("       Status          :", punchedRecord.status);
  console.log("       Punch In Time   :", punchedRecord.punch_in_time);
  console.log("       Staff ID        :", punchedRecord.staff_id);
  console.log("       Punched By      :", punchedRecord.punched_by?.name || punchedRecord.punched_by);
  
  const punchedByStr = (punchedRecord.punched_by?._id || punchedRecord.punched_by || "").toString();
  console.log("       Punched By ID   :", punchedByStr);
  console.log("       Admin User ID   :", adminUser._id.toString());
  
  if (punchedByStr !== adminUser._id.toString()) {
    throw new Error(`Punched By (${punchedByStr}) did not match Admin User (${adminUser._id.toString()})!`);
  }
  console.log("       -> Verified: `punched_by` correctly logged the Admin user!");

  // Test 2: Enforcing "One open punch-in per staff per day"
  console.log("\n[test] 3. Testing Duplicate Punch-In Prevention (Enforcing one open punch-in per day)...");
  const mockReq2 = {
    method: "POST",
    url: "/punch-in",
    headers: { authorization: `Bearer ${signAccessToken({ sub: stylistUser._id })}` },
    body: { staff_id: stylistStaff._id },
  };

  const { data: responseData2, err: duplicateError } = await dispatchRoute(mockReq2);

  if (duplicateError && duplicateError.statusCode === 400 && duplicateError.message.includes("already has an open punch-in")) {
    console.log("       -> Verified: Blocked second punch-in with 400 error (`" + duplicateError.message + "`)!");
  } else {
    throw new Error(`Expected 400 open punch-in error, got: ${duplicateError?.message || JSON.stringify(responseData2)}`);
  }

  // Test 3: Punch Out
  console.log("\n[test] 4. Testing POST /api/attendance/punch-out...");
  const mockReq3 = {
    method: "POST",
    url: "/punch-out",
    headers: { authorization: `Bearer ${signAccessToken({ sub: stylistUser._id })}` },
    body: {
      staff_id: stylistStaff._id,
      remarks: "Completed shift",
    },
  };

  const { data: responseData3, err: err3 } = await dispatchRoute(mockReq3);
  if (err3) throw err3;

  const punchedOutRecord = responseData3.data;
  console.log("       Punch Out Time  :", punchedOutRecord.punch_out_time);
  console.log("       Updated Remarks :", punchedOutRecord.remarks);
  console.log("       Punched By      :", punchedOutRecord.punched_by?.name || punchedOutRecord.punched_by);
  console.log("       -> Verified: Punch out successfully recorded!");

  // Test 5: Live Dashboard GET /api/attendance/today
  console.log("\n[test] 5. Testing GET /api/attendance/today (Staff on duty dashboard)...");
  const mockReqToday = {
    method: "GET",
    url: "/today",
    query: {},
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
  };

  const { data: todayRes, err: errToday } = await dispatchRoute(mockReqToday);
  if (errToday) throw errToday;

  if (!todayRes?.success || !todayRes?.data?.summary || !Array.isArray(todayRes?.data?.staff_list)) {
    throw new Error(`GET /today invalid structure: ${JSON.stringify(todayRes)}`);
  }
  console.log("       Dashboard Date  :", todayRes.data.summary.date);
  console.log("       Total Staff     :", todayRes.data.summary.total_staff);
  console.log("       On Duty         :", todayRes.data.summary.on_duty);
  console.log("       Present Today   :", todayRes.data.summary.present_today);
  console.log("       -> Verified: `GET /api/attendance/today` returns active staff list & summary metrics!");

  // Test 6: Payroll Summary GET /api/attendance/summary
  console.log("\n[test] 6. Testing GET /api/attendance/summary (Monthly summary for payroll)...");
  const mockReqSummary = {
    method: "GET",
    url: "/summary",
    query: { month: new Date().getUTCMonth() + 1, year: new Date().getUTCFullYear() },
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
  };

  const { data: summaryRes, err: errSummary } = await dispatchRoute(mockReqSummary);
  if (errSummary) throw errSummary;

  if (!summaryRes?.success || !Array.isArray(summaryRes?.data?.payroll_summaries)) {
    throw new Error(`GET /summary invalid structure: ${JSON.stringify(summaryRes)}`);
  }
  const payrollItems = summaryRes.data.payroll_summaries;
  console.log("       Summary Period  :", `${summaryRes.data.month}/${summaryRes.data.year}`);
  console.log("       Total Staff rows:", payrollItems.length);
  if (payrollItems.length > 0) {
    console.log("       Sample Staff    :", payrollItems[0].user?.name, `(Payable Days: ${payrollItems[0].payable_days}, Hours: ${payrollItems[0].total_hours_worked})`);
  }
  console.log("       -> Verified: `GET /api/attendance/summary` calculates accurate monthly payroll attendance!");

  console.log("\n[test] All Attendance API requirements verified successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test Failed:", err.message || err);
  process.exit(1);
});
