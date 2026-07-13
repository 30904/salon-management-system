import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import "../models/Branch.js";
import Customer from "../models/Customer.js";
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage, { CUSTOMER_PACKAGE_STATUSES } from "../models/CustomerPackage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting CustomerPackage DB Model Tests...\n");

  // 1. Verify Enum Definitions
  console.log("[test] 1. Checking CUSTOMER_PACKAGE_STATUSES enums...");
  const expectedStatuses = ["active", "expired", "exhausted", "cancelled"];
  for (const s of expectedStatuses) {
    if (!CUSTOMER_PACKAGE_STATUSES.includes(s)) {
      throw new Error(`Missing status enum: ${s}`);
    }
  }
  console.log("       -> Verified: All required statuses present (" + CUSTOMER_PACKAGE_STATUSES.join(", ") + ")\n");

  // 2. Ensure test Customer and PackageMaster exist
  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({
      name: "Test Package Customer",
      phone: "9988776655",
      email: "pkgcustomer@test.com",
    });
  }

  let pkgMaster = await PackageMaster.findOne();
  if (!pkgMaster) {
    pkgMaster = await PackageMaster.create({
      name: "Gold Spa & Hair Package",
      type: "prepaid_bundle",
      validity_days: 90,
      price: 4999,
      credit_count: 5,
    });
  }

  console.log(`[test] Using Customer      : ${customer.name} (${customer._id})`);
  console.log(`[test] Using PackageMaster : ${pkgMaster.name} (${pkgMaster._id})\n`);

  // Clean up any old test record with test invoice
  const testInvoiceId = "INV-TEST-PKG-001";
  await CustomerPackage.deleteMany({ invoice_id: testInvoiceId });

  // 3. Create a CustomerPackage record
  console.log("[test] 2. Testing CustomerPackage record creation...");
  const purchaseDate = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(purchaseDate.getDate() + pkgMaster.validity_days);

  const customerPkg = await CustomerPackage.create({
    customer_id: customer._id,
    package_master_id: pkgMaster._id,
    purchase_date: purchaseDate,
    expiry_date: expiryDate,
    credits_remaining: pkgMaster.credit_count,
    status: "active",
    invoice_id: testInvoiceId,
  });

  console.log("       Record ID          :", customerPkg._id);
  console.log("       Purchase Date      :", customerPkg.purchase_date.toISOString().split("T")[0]);
  console.log("       Expiry Date        :", customerPkg.expiry_date.toISOString().split("T")[0]);
  console.log("       Credits Remaining  :", customerPkg.credits_remaining);
  console.log("       Status             :", customerPkg.status);
  console.log("       Invoice ID         :", customerPkg.invoice_id);

  if (customerPkg.status !== "active" || customerPkg.credits_remaining !== 5 || customerPkg.invoice_id !== testInvoiceId) {
    throw new Error("CustomerPackage field values mismatch!");
  }
  console.log("       -> Verified: CustomerPackage created with all required fields exactly as specified!\n");

  // 4. Test Population and toSafeObject helper
  console.log("[test] 3. Testing population and toSafeObject helper...");
  const fetched = await CustomerPackage.findById(customerPkg._id)
    .populate("customer_id")
    .populate("package_master_id");

  const safeObj = fetched.toSafeObject();
  console.log("       Populated Customer :", safeObj.customer?.name);
  console.log("       Populated Package  :", safeObj.package_master?.name);

  if (!safeObj.customer?.name || !safeObj.package_master?.name || !safeObj.id) {
    throw new Error("toSafeObject failed to populate customer and package_master correctly!");
  }
  console.log("       -> Verified: `toSafeObject()` returns clean structure with nested customer & package_master objects!\n");

  // Cleanup
  await CustomerPackage.findByIdAndDelete(customerPkg._id);
  console.log("[test] Cleaned up test CustomerPackage record.");

  console.log("\n[test] CustomerPackage DB Model tests verified successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test Failed:", err.message || err);
  process.exit(1);
});
