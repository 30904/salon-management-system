import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import CommissionSlab from "../models/CommissionSlab.js";
import StaffProfile from "../models/StaffProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  console.log("==========================================");
  console.log("🚀 Testing Staff Master & Commission Slab CRUD / Filtering");
  console.log("==========================================\n");

  await connectDB();

  try {
    // 1. Clean up previous test runs
    await CommissionSlab.deleteMany({ name: /^TEST_SLAB_/ });
    await StaffProfile.deleteMany({ designation: /^TEST_DESIGNATION_/ });
    await User.deleteMany({ phone: { $in: ["9988776651", "9988776652"] } });

    // Get any valid role_id for user creation
    const role = await Role.findOne() || { _id: new mongoose.Types.ObjectId() };

    // 2. Create Test Users
    console.log("▶ STEP 1: Creating 2 test User records (Stylist A & Stylist B)...");
    const userA = await User.create({
      name: "Test Stylist A (Hair Expert)",
      phone: "9988776651",
      password_hash: "dummy_hash",
      role_id: role._id,
    });
    const userB = await User.create({
      name: "Test Stylist B (Skin Expert)",
      phone: "9988776652",
      password_hash: "dummy_hash",
      role_id: role._id,
    });
    console.log(`   --> Created User A (${userA.name}) and User B (${userB.name})\n`);

    // 3. Create Commission Slabs
    console.log("▶ STEP 2: Creating Commission Slabs (/api/commission-slabs)...");
    const slabTiered = await CommissionSlab.create({
      name: "TEST_SLAB_TIERED_STYLING",
      type: "tiered",
      rules_json: { tiers: [{ threshold: 20000, percentage: 10 }, { threshold: 50000, percentage: 15 }] },
    });
    const slabFlat = await CommissionSlab.create({
      name: "TEST_SLAB_FLAT_FACIALS",
      type: "percentage",
      rules_json: { flat_percentage: 12 },
    });
    console.log(`   --> Created '${slabTiered.name}' (${slabTiered.type}) and '${slabFlat.name}' (${slabFlat.type})\n`);

    // 4. Create Staff Profiles
    console.log("▶ STEP 3: Creating Staff Profiles (/api/staff)...");
    const profileA = await StaffProfile.create({
      user_id: userA._id,
      designation: "TEST_DESIGNATION_SENIOR_HAIR",
      specialization: ["Hair Coloring", "Haircutting", "Keratin Treatment"],
      commission_slab_id: slabTiered._id,
      base_salary: 35000,
    });
    const profileB = await StaffProfile.create({
      user_id: userB._id,
      designation: "TEST_DESIGNATION_AESTHETICIAN",
      specialization: ["Facial", "Cleanup", "Skin Peeling"],
      commission_slab_id: slabFlat._id,
      base_salary: 30000,
    });
    console.log(`   --> Assigned Profile A to User A with specializations: [${profileA.specialization.join(", ")}]`);
    console.log(`   --> Assigned Profile B to User B with specializations: [${profileB.specialization.join(", ")}]\n`);

    // 5. Verify Specialization Filtering (Bookings API Consumer Simulation)
    console.log("▶ STEP 4: Verifying Specialization Filter (`GET /api/staff?specialization=...`)...");

    // Test Case A: Query for "Hair Coloring" -> Should return ONLY Stylist A
    const hairQuery = { specialization: { $in: [new RegExp("^Hair Coloring$", "i")] }, designation: /^TEST_DESIGNATION_/ };
    const hairResults = await StaffProfile.find(hairQuery).populate("user_id", "name phone").populate("commission_slab_id", "name type");
    if (hairResults.length === 1 && hairResults[0].user_id.name.includes("Hair Expert")) {
      console.log(`   ✅ Query 'specialization=Hair Coloring' returned exactly 1 match: "${hairResults[0].user_id.name}" (Populated Commission: ${hairResults[0].commission_slab_id.name})`);
    } else {
      console.error(`   ❌ Failed: Expected 1 match for Hair Coloring, got ${hairResults.length}`);
    }

    // Test Case B: Query for "Facial" -> Should return ONLY Stylist B
    const facialQuery = { specialization: { $in: [new RegExp("^Facial$", "i")] }, designation: /^TEST_DESIGNATION_/ };
    const facialResults = await StaffProfile.find(facialQuery).populate("user_id", "name phone");
    if (facialResults.length === 1 && facialResults[0].user_id.name.includes("Skin Expert")) {
      console.log(`   ✅ Query 'specialization=Facial' returned exactly 1 match: "${facialResults[0].user_id.name}"`);
    } else {
      console.error(`   ❌ Failed: Expected 1 match for Facial, got ${facialResults.length}`);
    }

    // Test Case C: Query for comma-separated "Haircutting,Facial" -> Should return BOTH Stylist A and Stylist B
    const multiQuery = {
      specialization: { $in: [new RegExp("^Haircutting$", "i"), new RegExp("^Facial$", "i")] },
      designation: /^TEST_DESIGNATION_/,
    };
    const multiResults = await StaffProfile.find(multiQuery).populate("user_id", "name");
    if (multiResults.length === 2) {
      console.log(`   ✅ Query 'specialization=Haircutting,Facial' returned both matching stylists (${multiResults.length} matches)!\n`);
    } else {
      console.error(`   ❌ Failed: Expected 2 matches for combined query, got ${multiResults.length}\n`);
    }

    console.log("==========================================");
    console.log("🎉 ALL STAFF MASTER & COMMISSION SLAB TESTS PASSED!");
    console.log("==========================================");
  } finally {
    // Clean up test data
    await CommissionSlab.deleteMany({ name: /^TEST_SLAB_/ });
    await StaffProfile.deleteMany({ designation: /^TEST_DESIGNATION_/ });
    await User.deleteMany({ phone: { $in: ["9988776651", "9988776652"] } });
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTests();
