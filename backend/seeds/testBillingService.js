import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import "../models/Branch.js";
import Customer from "../models/Customer.js";
import "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import ServiceMaster from "../models/ServiceMaster.js";
import ProductMaster from "../models/ProductMaster.js";
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage from "../models/CustomerPackage.js";
import CommissionSlab from "../models/CommissionSlab.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import { createInvoice, voidInvoice, getInvoiceById } from "../services/billingService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting Billing Service (`billingService.js`) Atomic Tests...\n");

  // 1. Prepare dummy data
  console.log("[test] 1. Preparing test Customer, Staff with CommissionSlab, Product, & CustomerPackage...");
  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({ name: "Billing Service Customer", phone: "9123456780" });
  }

  let slab = await CommissionSlab.findOne({ name: "10 Percent Service Slab" });
  if (!slab) {
    slab = await CommissionSlab.create({
      name: "10 Percent Service Slab",
      type: "percentage",
      rules_json: { percentage: 10 },
      is_active: true,
    });
  }

  let staffList = await StaffProfile.find().limit(2);
  let staff1, staff2;
  if (staffList.length >= 2) {
    staff1 = staffList[0];
    staff2 = staffList[1];
  } else {
    const dummyUser1 = await Customer.create({ name: "Dummy Staff User 101", phone: "9000000101", email: "s101@test.com" });
    const dummyUser2 = await Customer.create({ name: "Dummy Staff User 102", phone: "9000000102", email: "s102@test.com" });
    staff1 = await StaffProfile.create({ user_id: dummyUser1._id, designation: "Senior Stylist", status: "active" });
    staff2 = await StaffProfile.create({ user_id: dummyUser2._id, designation: "Therapist", status: "active" });
  }

  // Assign commission slab to staff1
  staff1.commission_slab_id = slab._id;
  await staff1.save();

  // Create or reset test ProductMaster with stock = 20
  const testProductSku = "PROD-TEST-SHAMPOO-101";
  await ProductMaster.deleteMany({ sku: testProductSku });
  const product = await ProductMaster.create({
    name: "Luxury Keratin Shampoo 250ml",
    sku: testProductSku,
    unit: "bottle",
    purchase_price: 600,
    sale_price: 1200,
    current_stock: 20,
    reorder_level: 5,
    is_active: true,
  });

  // Create test CustomerPackage with 2 credits
  const testPkgMasterName = "Gold Spa Bundle 2-Pack";
  await PackageMaster.deleteMany({ name: testPkgMasterName });
  const pkgMaster = await PackageMaster.create({
    name: testPkgMasterName,
    type: "prepaid_bundle",
    validity_days: 60,
    price: 3000,
    credit_count: 2,
  });

  const testInvoiceNum = "INV-TEST-SERVICE-ATOMIC-01";
  // Clean up any orphaned records from prior failed test runs
  await Invoice.deleteMany({ invoice_number: testInvoiceNum });
  await CommissionEntry.deleteMany({ invoice_reference: testInvoiceNum });
  const customerPkg = await CustomerPackage.create({
    customer_id: customer._id,
    package_master_id: pkgMaster._id,
    purchase_date: new Date(),
    expiry_date: new Date(Date.now() + 60 * 24 * 3600 * 1000),
    credits_remaining: 2,
    status: "active",
  });

  console.log(`       Product SKU        : ${product.sku} (Initial Stock: ${product.current_stock})`);
  console.log(`       CustomerPackage    : ${pkgMaster.name} (Initial Credits: ${customerPkg.credits_remaining})`);
  console.log(`       Staff 1 Commission : Slab '${slab.name}' (${slab.rules_json.percentage}%)\n`);

  // 2. Execute `createInvoice` atomically
  console.log("[test] 2. Testing `createInvoice()` atomic transaction...");
  const invoicePayload = {
    invoice_number: testInvoiceNum,
    customer_id: customer._id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    payment_mode: "split",
    payment_status: "paid",
    split_payments: [
      { mode: "cash", amount: 1200 },
      { mode: "card", amount: 2000, reference_id: "CARD-REF-7788" },
    ],
    notes: "Testing atomic stock deduct, package redeem, & commission creation",
    line_items: [
      {
        item_type: "service",
        item_name: "Premium Haircut & Styling",
        quantity: 1,
        unit_price: 2000,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 2000,
        staff_id: staff1._id, // Staff 1 has 10% commission slab -> expected commission = 200
      },
      {
        item_type: "product",
        item_id: product._id,
        item_name: product.name,
        quantity: 3, // Buying 3 bottles -> expected stock after = 17
        unit_price: 1200,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 3600,
        staff_id: staff2._id, // Staff 2 gets explicit commission override
        commission_amount: 150, // Explicit 150 commission
      },
      {
        item_type: "package",
        item_id: pkgMaster._id,
        item_name: "Gold Spa Redemption (1 Credit)",
        quantity: 1, // Redeeming 1 credit -> expected remaining after = 1
        unit_price: 1500,
        total_amount: 1500,
        staff_id: staff2._id,
        package_redemption_id: customerPkg._id,
      },
    ],
  };

  const createdSafeObj = await createInvoice(invoicePayload);
  console.log("       Created Invoice ID :", createdSafeObj.id);
  console.log("       Grand Total        :", createdSafeObj.grand_total);
  console.log("       Line Items Count   :", createdSafeObj.line_items.length);
  if (createdSafeObj.line_items.length !== 3) {
    throw new Error("Expected exactly 3 line items created!");
  }
  console.log("       -> Verified: Invoice and LineItems created in database!\n");

  // 3. Verify Stock Deduct
  console.log("[test] 3. Verifying atomic Product Stock deduction...");
  const updatedProduct = await ProductMaster.findById(product._id);
  console.log("       Updated Stock      :", updatedProduct.current_stock);
  if (updatedProduct.current_stock !== 17) {
    throw new Error(`Expected product stock to be 17 (20 - 3), got ${updatedProduct.current_stock}`);
  }
  console.log("       -> Verified: ProductMaster.current_stock decremented from 20 to 17!\n");

  // 4. Verify Package Redemption
  console.log("[test] 4. Verifying atomic CustomerPackage credit deduction...");
  const updatedCustomerPkg = await CustomerPackage.findById(customerPkg._id);
  console.log("       Remaining Credits  :", updatedCustomerPkg.credits_remaining);
  if (updatedCustomerPkg.credits_remaining !== 1) {
    throw new Error(`Expected customer package credits remaining to be 1 (2 - 1), got ${updatedCustomerPkg.credits_remaining}`);
  }
  console.log("       -> Verified: CustomerPackage.credits_remaining decremented from 2 to 1!\n");

  // 5. Verify Commission Entries
  console.log("[test] 5. Verifying atomic CommissionEntry creation...");
  const commissions = await CommissionEntry.find({
    invoice_reference: testInvoiceNum,
  });
  console.log("       Commissions Found  :", commissions.length);
  const staff1Comm = commissions.find((c) => String(c.staff_id) === String(staff1._id));
  const staff2Comms = commissions.filter((c) => String(c.staff_id) === String(staff2._id));
  console.log("       Staff 1 Commission :", staff1Comm?.commission_amount, "(Expected: 200 from 10% slab of 2000)");
  console.log("       Staff 2 Commission :", staff2Comms.map((c) => c.commission_amount).join(", "), "(Expected: 150)");

  if (!staff1Comm || staff1Comm.commission_amount !== 200) {
    throw new Error(`Expected Staff 1 commission amount = 200, got ${staff1Comm?.commission_amount}`);
  }
  if (!staff2Comms.length || staff2Comms[0].commission_amount !== 150) {
    throw new Error(`Expected Staff 2 commission amount = 150, got ${staff2Comms[0]?.commission_amount}`);
  }
  console.log("       -> Verified: Commission entries created automatically and accurately using slab rules and overrides!\n");

  // 6. Test Atomic Void / Cancel Invoice
  console.log("[test] 6. Testing atomic `voidInvoice()` to reverse all actions...");
  await voidInvoice(createdSafeObj.id, { reason: "Customer requested cancellation" });

  const voidedProduct = await ProductMaster.findById(product._id);
  const voidedPkg = await CustomerPackage.findById(customerPkg._id);
  const voidedCommissions = await CommissionEntry.find({ invoice_reference: testInvoiceNum });
  const voidedInvoice = await getInvoiceById(createdSafeObj.id);

  console.log("       Voided Invoice Stat:", voidedInvoice.payment_status);
  console.log("       Restored Stock     :", voidedProduct.current_stock, "(Expected: 20)");
  console.log("       Restored Credits   :", voidedPkg.credits_remaining, "(Expected: 2)");
  console.log("       Remaining Comms    :", voidedCommissions.length, "(Expected: 0)");

  if (voidedInvoice.payment_status !== "void") {
    throw new Error("Expected voided invoice status to be 'void'");
  }
  if (voidedProduct.current_stock !== 20) {
    throw new Error(`Expected stock to be restored to 20, got ${voidedProduct.current_stock}`);
  }
  if (voidedPkg.credits_remaining !== 2) {
    throw new Error(`Expected package credits to be restored to 2, got ${voidedPkg.credits_remaining}`);
  }
  if (voidedCommissions.length !== 0) {
    throw new Error("Expected commission entries to be deleted upon invoice void!");
  }
  console.log("       -> Verified: `voidInvoice()` atomically restored stock, restored package credits, and deleted commission entries!\n");

  // Cleanup
  await InvoiceLineItem.deleteMany({ invoice_id: createdSafeObj.id });
  await Invoice.findByIdAndDelete(createdSafeObj.id);
  await ProductMaster.findByIdAndDelete(product._id);
  await CustomerPackage.findByIdAndDelete(customerPkg._id);
  await PackageMaster.findByIdAndDelete(pkgMaster._id);
  console.log("[test] Cleaned up test records.");

  console.log("\n[test] All `billingService.js` requirements verified successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test Failed:", err.message || err);
  process.exit(1);
});
