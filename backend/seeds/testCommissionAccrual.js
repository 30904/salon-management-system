import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Branch from "../models/Branch.js";
import Customer from "../models/Customer.js";
import StaffProfile from "../models/StaffProfile.js";
import CommissionSlab from "../models/CommissionSlab.js";
import CommissionEntry from "../models/CommissionEntry.js";
import { createInvoice, voidInvoice } from "../services/billingService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting Commission Accrual (`testCommissionAccrual.js`) Tests...\n");

  const testInvoiceNum = "COMM-TEST-INVOICE-" + Date.now();

  // ─── 1. Setup Data ────────────────────────────────────────────────────────
  console.log("[test] 1. Preparing Slabs, StaffProfiles, and Customer...");
  let branch = await Branch.findOne();
  if (!branch) {
    branch = await Branch.create({ name: "Commission Test Branch", code: "COMM1" });
  }

  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({ name: "Commission Test Customer", phone: "9888888888" });
  }

  // Clean old test slabs
  await CommissionSlab.deleteMany({
    name: {
      $in: [
        "Slab Percentage 15%",
        "Slab Flat 100",
        "Slab Tiered 5-10%",
        "Slab Threshold 50k",
      ],
    },
  });

  const pctSlab = await CommissionSlab.create({
    name: "Slab Percentage 15%",
    type: "percentage",
    rules_json: { percentage: 15 },
  });

  const flatSlab = await CommissionSlab.create({
    name: "Slab Flat 100",
    type: "flat",
    rules_json: { flat_amount: 100 },
  });

  const tieredSlab = await CommissionSlab.create({
    name: "Slab Tiered 5-10%",
    type: "tiered",
    rules_json: {
      tiers: [
        { min: 0, max: 1000, rate: 5, is_percentage: true },
        { min: 1001, max: 100000, rate: 10, is_percentage: true },
      ],
    },
  });

  const thresholdSlab = await CommissionSlab.create({
    name: "Slab Threshold 50k",
    type: "threshold",
    rules_json: {
      threshold_amount: 50000,
      bonus_rate: 12,
      period: "monthly",
    },
  });

  // Create or clean test staff profiles
  await StaffProfile.deleteMany({
    employee_id: { $in: ["EMP-COMM-1", "EMP-COMM-2", "EMP-COMM-3", "EMP-COMM-4", "EMP-COMM-5"] },
  });

  const staffPct = await StaffProfile.create({
    user_id: new mongoose.Types.ObjectId(),
    branch_id: branch._id,
    employee_id: "EMP-COMM-1",
    designation: "Senior Stylist",
    commission_slab_id: pctSlab._id,
  });

  const staffFlat = await StaffProfile.create({
    user_id: new mongoose.Types.ObjectId(),
    branch_id: branch._id,
    employee_id: "EMP-COMM-2",
    designation: "Nail Artist",
    commission_slab_id: flatSlab._id,
  });

  const staffTiered = await StaffProfile.create({
    user_id: new mongoose.Types.ObjectId(),
    branch_id: branch._id,
    employee_id: "EMP-COMM-3",
    designation: "Spa Therapist",
    commission_slab_id: tieredSlab._id,
  });

  const staffThreshold = await StaffProfile.create({
    user_id: new mongoose.Types.ObjectId(),
    branch_id: branch._id,
    employee_id: "EMP-COMM-4",
    designation: "Salon Director",
    commission_slab_id: thresholdSlab._id,
  });

  const staffManual = await StaffProfile.create({
    user_id: new mongoose.Types.ObjectId(),
    branch_id: branch._id,
    employee_id: "EMP-COMM-5",
    designation: "Specialist",
    commission_slab_id: pctSlab._id, // has 15% slab but will get manual override
  });

  console.log("       Profiles and Slabs created successfully.\n");

  // ─── 2. Create Invoice with all 5 Line Items ─────────────────────────────
  console.log("[test] 2. Creating Invoice with line items covering all slab types & manual override...");
  const invoicePayload = {
    invoice_number: testInvoiceNum,
    branch_id: branch._id,
    customer_id: customer._id,
    billing_date: new Date(),
    payment_status: "paid",
    payment_mode: "cash",
    totals: {
      subtotal: 11500,
      discount_total: 0,
      tax_total: 2070,
      grand_total: 13570,
      amount_paid: 13570,
      amount_due: 0,
    },
    line_items: [
      {
        item_type: "service",
        item_name: "Hair Coloring (Pct Slab)",
        quantity: 1,
        unit_price: 2000,
        discount_amount: 0,
        tax_rate: 18,
        tax_amount: 360,
        total_amount: 2360,
        staff_id: staffPct._id,
      },
      {
        item_type: "service",
        item_name: "Gel Manicure x3 (Flat Slab)",
        quantity: 3,
        unit_price: 500,
        discount_amount: 0,
        tax_rate: 18,
        tax_amount: 270,
        total_amount: 1770,
        staff_id: staffFlat._id,
      },
      {
        item_type: "service",
        item_name: "Deep Tissue Massage (Tiered Slab)",
        quantity: 1,
        unit_price: 1500,
        discount_amount: 0,
        tax_rate: 18,
        tax_amount: 270,
        total_amount: 1770,
        staff_id: staffTiered._id,
      },
      {
        item_type: "service",
        item_name: "VIP Package Booking (Threshold Slab)",
        quantity: 1,
        unit_price: 5000,
        discount_amount: 0,
        tax_rate: 18,
        tax_amount: 900,
        total_amount: 5900,
        staff_id: staffThreshold._id,
      },
      {
        item_type: "service",
        item_name: "Special Consultation (Manual Override)",
        quantity: 1,
        unit_price: 1500,
        discount_amount: 0,
        tax_rate: 18,
        tax_amount: 270,
        total_amount: 1770,
        staff_id: staffManual._id,
        commission_amount: 250, // explicit manual override
      },
    ],
  };

  const createdSafeObj = await createInvoice(invoicePayload);
  console.log(`       Invoice created ID: ${createdSafeObj.id}\n`);

  // ─── 3. Verify Commission Entries ─────────────────────────────────────────
  console.log("[test] 3. Querying CommissionEntry records for invoice...");
  const entries = await CommissionEntry.find({ invoice_reference: testInvoiceNum }).sort({ _id: 1 });
  console.log(`       Total CommissionEntry rows written: ${entries.length} (Expected: 5)\n`);

  if (entries.length !== 5) {
    throw new Error(`Expected 5 CommissionEntry records, found ${entries.length}`);
  }

  // Check Staff A (Percentage)
  const entryPct = entries.find((e) => String(e.staff_id) === String(staffPct._id));
  console.log("       [Check 1: Percentage Slab (15% of ₹2000)]");
  console.log(`         -> Amount    : ₹${entryPct?.commission_amount} (Expected: 300)`);
  console.log(`         -> Slab Type : ${entryPct?.slab_type} (Expected: percentage)`);
  console.log(`         -> Status    : ${entryPct?.status} (Expected: accrued)`);
  if (!entryPct || entryPct.commission_amount !== 300 || entryPct.slab_type !== "percentage" || entryPct.status !== "accrued") {
    throw new Error("Percentage slab check failed");
  }
  console.log("         -> PASSED\n");

  // Check Staff B (Flat)
  const entryFlat = entries.find((e) => String(e.staff_id) === String(staffFlat._id));
  console.log("       [Check 2: Flat Slab (₹100 x 3 qty)]");
  console.log(`         -> Amount    : ₹${entryFlat?.commission_amount} (Expected: 300)`);
  console.log(`         -> Slab Type : ${entryFlat?.slab_type} (Expected: flat)`);
  console.log(`         -> Status    : ${entryFlat?.status} (Expected: accrued)`);
  if (!entryFlat || entryFlat.commission_amount !== 300 || entryFlat.slab_type !== "flat" || entryFlat.status !== "accrued") {
    throw new Error("Flat slab check failed");
  }
  console.log("         -> PASSED\n");

  // Check Staff C (Tiered)
  const entryTiered = entries.find((e) => String(e.staff_id) === String(staffTiered._id));
  console.log("       [Check 3: Tiered Slab (₹1500 revenue falls into 10% tier)]");
  console.log(`         -> Amount    : ₹${entryTiered?.commission_amount} (Expected: 150)`);
  console.log(`         -> Slab Type : ${entryTiered?.slab_type} (Expected: tiered)`);
  console.log(`         -> Status    : ${entryTiered?.status} (Expected: accrued)`);
  if (!entryTiered || entryTiered.commission_amount !== 150 || entryTiered.slab_type !== "tiered" || entryTiered.status !== "accrued") {
    throw new Error("Tiered slab check failed");
  }
  console.log("         -> PASSED\n");

  // Check Staff D (Threshold - deferred to payroll)
  const entryThreshold = entries.find((e) => String(e.staff_id) === String(staffThreshold._id));
  console.log("       [Check 4: Threshold Slab (deferred to payroll calculation)]");
  console.log(`         -> Amount    : ₹${entryThreshold?.commission_amount} (Expected: 0)`);
  console.log(`         -> Slab Type : ${entryThreshold?.slab_type} (Expected: threshold)`);
  console.log(`         -> Status    : ${entryThreshold?.status} (Expected: deferred_threshold)`);
  console.log(`         -> Details   : ${entryThreshold?.calculation_details_json?.note}`);
  if (!entryThreshold || entryThreshold.commission_amount !== 0 || entryThreshold.slab_type !== "threshold" || entryThreshold.status !== "deferred_threshold") {
    throw new Error("Threshold slab deferred check failed");
  }
  console.log("         -> PASSED\n");

  // Check Staff E (Manual Override)
  const entryManual = entries.find((e) => String(e.staff_id) === String(staffManual._id));
  console.log("       [Check 5: Manual Override (override amount ₹250)]");
  console.log(`         -> Amount    : ₹${entryManual?.commission_amount} (Expected: 250)`);
  console.log(`         -> Slab Type : ${entryManual?.slab_type} (Expected: manual_override)`);
  console.log(`         -> Status    : ${entryManual?.status} (Expected: accrued)`);
  if (!entryManual || entryManual.commission_amount !== 250 || entryManual.slab_type !== "manual_override" || entryManual.status !== "accrued") {
    throw new Error("Manual override check failed");
  }
  console.log("         -> PASSED\n");

  // ─── 4. Test Void / Clean Up ──────────────────────────────────────────────
  console.log("[test] 4. Testing voidInvoice() reversal of commission entries...");
  await voidInvoice(createdSafeObj.id, { reason: "Testing reversal" });
  const voidedEntries = await CommissionEntry.find({ invoice_reference: testInvoiceNum });
  console.log(`       Remaining entries after void: ${voidedEntries.length} (Expected: 0)`);
  if (voidedEntries.length !== 0) {
    throw new Error("Commission entries not cleanly removed on invoice void");
  }
  console.log("       -> PASSED\n");

  // Cleanup test profiles
  await StaffProfile.deleteMany({
    employee_id: { $in: ["EMP-COMM-1", "EMP-COMM-2", "EMP-COMM-3", "EMP-COMM-4", "EMP-COMM-5"] },
  });
  await CommissionSlab.deleteMany({
    name: {
      $in: [
        "Slab Percentage 15%",
        "Slab Flat 100",
        "Slab Tiered 5-10%",
        "Slab Threshold 50k",
      ],
    },
  });

  console.log("[test] All Commission Accrual tests passed successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test failed:", err.message || err);
  process.exit(1);
});
