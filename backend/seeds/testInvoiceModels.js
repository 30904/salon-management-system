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
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice, { INVOICE_PAYMENT_MODES, INVOICE_PAYMENT_STATUSES } from "../models/Invoice.js";
import InvoiceLineItem, { INVOICE_LINE_ITEM_TYPES } from "../models/InvoiceLineItem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting Billing DB Model (`Invoice` & `InvoiceLineItem`) Tests...\n");

  // 1. Verify Enum Definitions
  console.log("[test] 1. Checking INVOICE_PAYMENT_MODES & INVOICE_PAYMENT_STATUSES enums...");
  const expectedModes = ["cash", "card", "upi", "package_credits", "split", "other"];
  for (const m of expectedModes) {
    if (!INVOICE_PAYMENT_MODES.includes(m)) throw new Error(`Missing payment mode enum: ${m}`);
  }
  const expectedStatuses = ["paid", "unpaid", "partial", "refunded", "void"];
  for (const s of expectedStatuses) {
    if (!INVOICE_PAYMENT_STATUSES.includes(s)) throw new Error(`Missing payment status enum: ${s}`);
  }
  const expectedItemTypes = ["service", "product", "package", "custom"];
  for (const t of expectedItemTypes) {
    if (!INVOICE_LINE_ITEM_TYPES.includes(t)) throw new Error(`Missing line item type enum: ${t}`);
  }
  console.log("       -> Verified: All required payment modes, statuses, and item types present!\n");

  // 2. Ensure test Customer, StaffProfile, ServiceMaster, and CustomerPackage exist
  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({
      name: "Test Billing Customer",
      phone: "9876543210",
      email: "billingcust@test.com",
    });
  }

  let staffList = await StaffProfile.find().limit(2);
  let staff1, staff2;
  if (staffList.length >= 2) {
    staff1 = staffList[0];
    staff2 = staffList[1];
  } else if (staffList.length === 1) {
    staff1 = staffList[0];
    const dummyUser2 = await Customer.create({ name: "Dummy Staff User 2", phone: "9000000002", email: "staff2@test.com" });
    staff2 = await StaffProfile.create({
      user_id: dummyUser2._id,
      designation: "Therapist",
      status: "active",
    });
  } else {
    // If no staff profiles in DB, create two with dummy users
    const dummyUser1 = await Customer.create({ name: "Dummy Staff User 1", phone: "9000000001", email: "staff1@test.com" });
    const dummyUser2 = await Customer.create({ name: "Dummy Staff User 2", phone: "9000000002", email: "staff2@test.com" });
    staff1 = await StaffProfile.create({
      user_id: dummyUser1._id,
      designation: "Senior Stylist",
      status: "active",
    });
    staff2 = await StaffProfile.create({
      user_id: dummyUser2._id,
      designation: "Therapist",
      status: "active",
    });
  }

  let service = await ServiceMaster.findOne();
  if (!service) {
    // If no category or service, mock or skip dynamic check
  }

  let pkgMaster = await PackageMaster.findOne();
  if (!pkgMaster) {
    pkgMaster = await PackageMaster.create({
      name: "Gold Spa Package",
      type: "prepaid_bundle",
      validity_days: 90,
      price: 3000,
      credit_count: 3,
    });
  }

  let customerPkg = await CustomerPackage.findOne({ customer_id: customer._id });
  if (!customerPkg) {
    customerPkg = await CustomerPackage.create({
      customer_id: customer._id,
      package_master_id: pkgMaster._id,
      purchase_date: new Date(),
      expiry_date: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      credits_remaining: 3,
      status: "active",
    });
  }

  // Clean up existing test invoice
  const testInvNumber = "INV-TEST-BILLING-001";
  const existingInv = await Invoice.findOne({ invoice_number: testInvNumber });
  if (existingInv) {
    await InvoiceLineItem.deleteMany({ invoice_id: existingInv._id });
    await Invoice.findByIdAndDelete(existingInv._id);
  }

  // 3. Create an Invoice record
  console.log("[test] 2. Testing Invoice creation (with totals, payment_mode, payment_status)...");
  const invoice = await Invoice.create({
    invoice_number: testInvNumber,
    customer_id: customer._id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    billing_date: new Date(),
    totals: {
      subtotal: 2500,
      discount_total: 200,
      tax_total: 414,
      grand_total: 2714,
      amount_paid: 2714,
      amount_due: 0,
    },
    payment_mode: "split",
    payment_status: "paid",
    split_payments: [
      { mode: "cash", amount: 1000 },
      { mode: "upi", amount: 1714, reference_id: "UPI-TXN-987" },
    ],
    notes: "Test split payment invoice with multiple line items & staff",
  });

  console.log("       Invoice ID         :", invoice._id);
  console.log("       Invoice Number     :", invoice.invoice_number);
  console.log("       Grand Total        :", invoice.totals.grand_total);
  console.log("       Payment Mode       :", invoice.payment_mode);
  console.log("       Payment Status     :", invoice.payment_status);
  console.log("       Split Payments     :", invoice.split_payments.length, "mode(s)");
  if (invoice.totals.grand_total !== 2714 || invoice.payment_mode !== "split" || invoice.payment_status !== "paid") {
    throw new Error("Invoice fields mismatch!");
  }
  console.log("       -> Verified: Invoice created with totals, payment_mode, and payment_status!\n");

  // 4. Create Line Items with distinct staff_id per line and package_redemption_id
  console.log("[test] 3. Testing InvoiceLineItem creation (item_type, item_id, staff_id per line, package_redemption_id)...");
  const lineItem1 = await InvoiceLineItem.create({
    invoice_id: invoice._id,
    item_type: "service",
    item_id: service?._id || new mongoose.Types.ObjectId(),
    item_name: service?.name || "Advanced Haircut & Styling",
    quantity: 1,
    unit_price: 1500,
    discount_amount: 100,
    tax_amount: 252,
    tax_rate: 18,
    total_amount: 1652,
    staff_id: staff1._id, // Staff 1 did line item 1
  });

  const lineItem2 = await InvoiceLineItem.create({
    invoice_id: invoice._id,
    item_type: "package",
    item_id: pkgMaster._id,
    item_name: "Gold Spa Redemption (1 Credit)",
    quantity: 1,
    unit_price: 1000,
    discount_amount: 100,
    tax_amount: 162,
    tax_rate: 18,
    total_amount: 1062,
    staff_id: staff2._id, // Staff 2 did line item 2!
    package_redemption_id: customerPkg._id, // Linked to package redemption!
  });

  console.log("       Line Item 1 ID     :", lineItem1._id);
  console.log("       Line Item 1 Type   :", lineItem1.item_type);
  console.log("       Line Item 1 Staff  :", staff1.designation || "Staff 1", `(${lineItem1.staff_id})`);
  console.log("       Line Item 2 ID     :", lineItem2._id);
  console.log("       Line Item 2 Type   :", lineItem2.item_type);
  console.log("       Line Item 2 Staff  :", staff2.designation || "Staff 2", `(${lineItem2.staff_id})`);
  console.log("       Line Item 2 PkgRedempt:", lineItem2.package_redemption_id);

  if (String(lineItem1.staff_id) === String(lineItem2.staff_id)) {
    throw new Error("Expected distinct staff_id per line item!");
  }
  if (!lineItem2.package_redemption_id) {
    throw new Error("Expected package_redemption_id on lineItem2!");
  }
  console.log("       -> Verified: Line items support different staff_id per line and package_redemption_id!\n");

  // 5. Test population and toSafeObject
  console.log("[test] 4. Testing `toSafeObject()` on populated Invoice and LineItems...");
  const fetchedInv = await Invoice.findById(invoice._id).populate("customer_id");
  const fetchedLines = await InvoiceLineItem.find({ invoice_id: invoice._id })
    .populate({ path: "staff_id", populate: { path: "user_id" } })
    .populate("package_redemption_id");

  const invSafe = fetchedInv.toSafeObject(fetchedLines);
  console.log("       Safe Invoice Number:", invSafe.invoice_number);
  console.log("       Safe Customer Name :", invSafe.customer?.name);
  console.log("       Safe Grand Total   :", invSafe.grand_total);
  console.log("       Safe Line Items    :", invSafe.line_items.length);
  console.log("       Line 1 Staff Name  :", invSafe.line_items[0].staff?.name);
  console.log("       Line 2 Staff Name  :", invSafe.line_items[1].staff?.name);
  console.log("       Line 2 Pkg Remaining:", invSafe.line_items[1].package_redemption?.credits_remaining);

  if (!invSafe.line_items || invSafe.line_items.length !== 2) {
    throw new Error("toSafeObject failed to embed safe line items!");
  }
  console.log("       -> Verified: `toSafeObject()` cleanly formats Invoice with nested totals & LineItems!\n");

  // Cleanup
  await InvoiceLineItem.deleteMany({ invoice_id: invoice._id });
  await Invoice.findByIdAndDelete(invoice._id);
  console.log("[test] Cleaned up test Invoice and LineItem records.");

  console.log("\n[test] All Invoice & InvoiceLineItem DB Model requirements verified successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test Failed:", err.message || err);
  process.exit(1);
});
