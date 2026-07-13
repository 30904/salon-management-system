import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import PackageMaster from "../models/PackageMaster.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testPackageMasterApi() {
  console.log("==========================================");
  console.log("🚀 Testing Package Master API (/api/package-masters)");
  console.log("==========================================\n");

  await connectDB();

  try {
    const port = process.env.PORT || 5000;
    const baseURL = `http://localhost:${port}/api`;

    let user = await User.findOne({ role_id: { $ne: null } });
    if (!user) {
      user = await User.findOne({});
    }

    if (!user) {
      console.log("⚠️ No users found in DB. Creating temporary admin user for API testing...");
      user = await User.create({
        name: "Test Admin",
        phone: "9999977777",
        password_hash: "dummyhash",
        is_active: true,
      });
    }

    const { signAccessToken } = await import("../utils/jwt.js");
    const token = signAccessToken({ sub: user._id });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    await PackageMaster.deleteMany({ name: /^API_TEST_PKG/ });

    // 1. Test POST /api/package-masters (Prepaid Bundle)
    console.log("▶ STEP 1: Testing POST /api/package-masters (Create Prepaid Bundle)...");
    const createRes = await fetch(`${baseURL}/package-masters`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "API_TEST_PKG_GLOW_SPA",
        type: "prepaid_bundle",
        validity_days: 90,
        price: 4999,
        credit_count: 5,
        included_services: [
          { service_id: "65b123456789012345678901", sittings_allowed: 5 },
        ],
      }),
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error(`Create package failed: ${createData.message}`);
    console.log(`   ✅ Created Package via API: "${createData.data.name}" (${createData.data.type}, ₹${createData.data.price}, ${createData.data.validity_days} days)`);

    // 2. Test GET /api/package-masters
    console.log("\n▶ STEP 2: Testing GET /api/package-masters (List Packages)...");
    const listRes = await fetch(`${baseURL}/package-masters?type=prepaid_bundle`, { headers });
    const listData = await listRes.json();
    if (!listData.success) throw new Error(`List packages failed: ${listData.message}`);
    console.log(`   ✅ Listed Packages via API: Retrieved ${listData.data.length} prepaid bundle(s)`);

    // 3. Test PUT /api/package-masters/:id
    console.log("\n▶ STEP 3: Testing PUT /api/package-masters/:id (Update Package)...");
    const updateRes = await fetch(`${baseURL}/package-masters/${createData.data.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        price: 4499,
        validity_days: 120,
      }),
    });
    const updateData = await updateRes.json();
    if (!updateData.success) throw new Error(`Update package failed: ${updateData.message}`);
    console.log(`   ✅ Updated Package via API: New Price ₹${updateData.data.price}, Validity: ${updateData.data.validity_days} days`);

    // 4. Test DELETE /api/package-masters/:id
    console.log("\n▶ STEP 4: Testing DELETE /api/package-masters/:id (Deactivate Package)...");
    const deleteRes = await fetch(`${baseURL}/package-masters/${createData.data.id}`, {
      method: "DELETE",
      headers,
    });
    const deleteData = await deleteRes.json();
    if (!deleteData.success) throw new Error(`Delete package failed: ${deleteData.message}`);
    console.log(`   ✅ Deactivated Package via API: is_active = ${deleteData.data.is_active}`);

    console.log("\n==========================================");
    console.log("🎉 ALL PACKAGE MASTER API CRUD TESTS PASSED!");
    console.log("==========================================");
  } finally {
    await PackageMaster.deleteMany({ name: /^API_TEST_PKG/ });
    await mongoose.connection.close();
    process.exit(0);
  }
}

testPackageMasterApi();
