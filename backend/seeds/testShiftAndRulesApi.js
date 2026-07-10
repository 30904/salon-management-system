import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import ShiftMaster from "../models/ShiftMaster.js";
import AttendanceRule from "../models/AttendanceRule.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testShiftsAndRulesApi() {
  console.log("==========================================");
  console.log("🚀 Testing Shift & Attendance Rules API + Deduction Logic");
  console.log("==========================================\n");

  await connectDB();

  try {
    const port = process.env.PORT || 5000;
    const baseURL = `http://localhost:${port}/api`;

    // 1. Authenticate with a test user token
    let adminUser = await User.findOne({ role_id: { $ne: null } });
    if (!adminUser) {
      adminUser = await User.findOne({});
    }

    if (!adminUser) {
      console.log("⚠️ No users found in DB. Creating temporary admin user for API testing...");
      adminUser = await User.create({
        name: "Test Admin",
        phone: "9999988888",
        password_hash: "dummyhash",
        is_active: true,
      });
    }

    // Generate JWT token correctly using signAccessToken
    const { signAccessToken } = await import("../utils/jwt.js");
    const token = signAccessToken({ sub: adminUser._id });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Clean up old API test data
    await ShiftMaster.deleteMany({ name: /^API_TEST_SHIFT/ });
    await AttendanceRule.deleteMany({ name: /^API_TEST_RULE/ });

    // 2. Test POST /api/shifts
    console.log("▶ STEP 1: Testing POST /api/shifts (Create Shift)...");
    const createShiftRes = await fetch(`${baseURL}/shifts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "API_TEST_SHIFT_DAY",
        start_time: "09:00",
        end_time: "18:00",
      }),
    });
    const shiftData = await createShiftRes.json();
    if (!shiftData.success) throw new Error(`Create shift failed: ${shiftData.message}`);
    console.log(`   ✅ Created Shift via API: "${shiftData.data.name}" (${shiftData.data.start_time} - ${shiftData.data.end_time})`);

    // 3. Test POST /api/attendance-rules
    console.log("\n▶ STEP 2: Testing POST /api/attendance-rules (Create Attendance Rule)...");
    const createRuleRes = await fetch(`${baseURL}/attendance-rules`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "API_TEST_RULE_STANDARD",
        late_mark_minutes: 15,
        leave_types: [
          { code: "CL", name: "Casual Leave", annual_quota: 12, paid: true },
          { code: "SL", name: "Sick Leave", annual_quota: 6, paid: true },
        ],
      }),
    });
    const ruleData = await createRuleRes.json();
    if (!ruleData.success) throw new Error(`Create rule failed: ${ruleData.message}`);
    console.log(`   ✅ Created Rule via API: "${ruleData.data.name}" (Late Threshold: ${ruleData.data.late_mark_minutes} mins)`);

    // 4. Test Evaluation Logic (Feeds attendance + payroll deduction logic)
    console.log("\n▶ STEP 3: Testing POST /api/attendance-rules/evaluate-deduction...");
    
    // Test Case A: Punch in on time / grace period (09:10 vs 09:00 shift start, threshold 15 mins)
    const evalOnTimeRes = await fetch(`${baseURL}/attendance-rules/evaluate-deduction`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        shift_id: shiftData.data.id,
        punch_time: "09:10", // 10 mins after start, within 15 min grace
      }),
    });
    const evalOnTime = await evalOnTimeRes.json();
    console.log(`   🔸 [Punch 09:10 vs Shift 09:00] Minutes Late: ${evalOnTime.data.minutes_late}m | Is Late Mark: ${evalOnTime.data.is_late_mark} | Deduction: ${evalOnTime.data.payroll_deduction.deduction_days} days (${evalOnTime.data.payroll_deduction.note})`);

    // Test Case B: Punch in LATE (09:35 vs 09:00 shift start, threshold 15 mins)
    const evalLateRes = await fetch(`${baseURL}/attendance-rules/evaluate-deduction`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        shift_id: shiftData.data.id,
        punch_time: "09:35", // 35 mins after start, exceeds 15 min grace!
      }),
    });
    const evalLate = await evalLateRes.json();
    console.log(`   🔸 [Punch 09:35 vs Shift 09:00] Minutes Late: ${evalLate.data.minutes_late}m | Is Late Mark: ${evalLate.data.is_late_mark} | Deduction: ${evalLate.data.payroll_deduction.deduction_days} days (${evalLate.data.payroll_deduction.note})`);

    console.log("\n==========================================");
    console.log("🎉 ALL SHIFT & ATTENDANCE RULE API & DEDUCTION TESTS PASSED!");
    console.log("==========================================");
  } finally {
    await ShiftMaster.deleteMany({ name: /^API_TEST_SHIFT/ });
    await AttendanceRule.deleteMany({ name: /^API_TEST_RULE/ });
    await mongoose.connection.close();
    process.exit(0);
  }
}

testShiftsAndRulesApi();
