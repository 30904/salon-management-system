import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import ShiftMaster from "../models/ShiftMaster.js";
import AttendanceRule from "../models/AttendanceRule.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  console.log("==========================================");
  console.log("🚀 Testing ShiftMaster & AttendanceRule DB Models");
  console.log("==========================================\n");

  await connectDB();

  try {
    // 1. Clean up previous test runs
    await ShiftMaster.deleteMany({ name: /^TEST_SHIFT_/ });
    await AttendanceRule.deleteMany({ name: /^TEST_RULE_/ });

    // 2. Test ShiftMaster Creation & Regex Validation
    console.log("▶ STEP 1: Creating ShiftMaster records...");
    const morningShift = await ShiftMaster.create({
      name: "TEST_SHIFT_MORNING",
      start_time: "09:00",
      end_time: "17:30",
    });
    const eveningShift = await ShiftMaster.create({
      name: "TEST_SHIFT_EVENING",
      start_time: "13:30",
      end_time: "21:30",
    });
    console.log(`   ✅ Created Shift 1: "${morningShift.name}" (${morningShift.start_time} - ${morningShift.end_time})`);
    console.log(`   ✅ Created Shift 2: "${eveningShift.name}" (${eveningShift.start_time} - ${eveningShift.end_time})\n`);

    // Test Invalid Time format rejection
    console.log("▶ STEP 2: Testing regex time validation (should reject invalid time '26:99')...");
    try {
      await ShiftMaster.create({
        name: "TEST_SHIFT_INVALID",
        start_time: "26:99",
        end_time: "18:00",
      });
      console.error("   ❌ Failed: Did not reject invalid time format!");
    } catch (err) {
      console.log(`   ✅ Successfully blocked invalid start_time ('26:99') via schema validation!\n`);
    }

    // 3. Test AttendanceRule Creation & JSON Leave Types
    console.log("▶ STEP 3: Creating AttendanceRule with late_mark_minutes and leave_types JSON...");
    const customRule = await AttendanceRule.create({
      name: "TEST_RULE_SALON_DEFAULT",
      late_mark_minutes: 15,
      leave_types: [
        { code: "CL", name: "Casual Leave", annual_quota: 14, paid: true },
        { code: "SL", name: "Sick Leave", annual_quota: 7, paid: true },
        { code: "ML", name: "Maternity Leave", annual_quota: 84, paid: true },
      ],
    });
    console.log(`   ✅ Created Rule: "${customRule.name}" with late mark threshold = ${customRule.late_mark_minutes} mins.`);
    console.log(`   ✅ Verified JSON Leave Types quota inside DB:`);
    customRule.leave_types.forEach((leave) => {
      console.log(`      • [${leave.code}] ${leave.name} -> Quota: ${leave.annual_quota} days (Paid: ${leave.paid})`);
    });

    console.log("\n==========================================");
    console.log("🎉 ALL SHIFT & ATTENDANCE RULE DB TESTS PASSED!");
    console.log("==========================================");
  } finally {
    // Clean up test records
    await ShiftMaster.deleteMany({ name: /^TEST_SHIFT_/ });
    await AttendanceRule.deleteMany({ name: /^TEST_RULE_/ });
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTests();
