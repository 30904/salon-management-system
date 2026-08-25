/**
 * Feature 4 tracker row 23 / MD 4.8 — payroll month include + no double-count.
 *
 * Force-enables the payroll redo gate for this process only (via env + dynamic import),
 * then:
 * - Completed redo in month → PayrollEntry.redo_product_cost_deduction matches
 * - net_payable = base − unpaid deduction + commission − redo cost
 * - Draft re-run (runPayrollForMonth again) does not double the cut
 *
 * Usage:
 *   npm run test:payroll-redo-month
 *
 * Production coded default stays OFF (see test:redo-gate).
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/ShiftMaster.js";
import "../models/LeaveRequest.js";
import "../models/Holiday.js";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import RedoRequest from "../models/RedoRequest.js";
import { hashPassword } from "../services/userService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "payroll-redo-month-test";
const PHONE = "9100000233";
const YEAR = 2098;
const MONTH = 4;
const BASE_SALARY = 30000;
const REDO_COST = 475;

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

async function cleanup() {
  const run = await PayrollRun.findOne({ month: MONTH, year: YEAR });
  if (run) {
    await PayrollEntry.deleteMany({ payroll_run_id: run._id });
    await PayrollRun.deleteOne({ _id: run._id });
  }
  await RedoRequest.deleteMany({ reason: TAG });

  const user = await User.findOne({ phone: PHONE }).select("_id");
  if (user) {
    await StaffProfile.deleteMany({ user_id: user._id });
    await User.deleteOne({ _id: user._id });
  }
  await Customer.deleteMany({ phone: PHONE });
}

async function main() {
  // Force gate ON for this process, then load payroll modules (they read the gate at import).
  process.env.REDO_PAYROLL_DEDUCTION_ENABLED = "true";
  const { calculateNetPayable, runPayrollForMonth } = await import(
    "../services/payrollService.js"
  );
  const { isRedoPayrollDeductionEnabled } = await import("../constants/redoConstants.js");

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — payroll redo month include + no double\n");

  assert(
    isRedoPayrollDeductionEnabled() === true,
    "test process force-enables payroll redo gate via env"
  );

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const user = await User.create({
    name: "Payroll Redo Month Test",
    phone: PHONE,
    email: `${PHONE}@payroll-redo-month.test`,
    password_hash: await hashPassword("Test@123"),
    role_id: role._id,
    is_active: true,
  });

  const staff = await StaffProfile.create({
    user_id: user._id,
    designation: "Stylist",
    weekly_off_day: 2,
    base_salary: BASE_SALARY,
    is_active: true,
  });

  const midMonth = new Date(Date.UTC(YEAR, MONTH - 1, 15, 12, 0, 0));
  const redo = await RedoRequest.create({
    original_invoice_id: new mongoose.Types.ObjectId(),
    original_line_item_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    original_staff_id: staff._id,
    redo_staff_id: staff._id,
    status: "completed",
    requested_by: user._id,
    reason: TAG,
    total_product_cost: REDO_COST,
    payroll_run_id: null,
    products_used: [],
  });

  // Month filter uses updatedAt — pin into payroll month.
  await RedoRequest.collection.updateOne(
    { _id: redo._id },
    { $set: { updatedAt: midMonth, createdAt: midMonth } }
  );

  const first = await runPayrollForMonth({ month: MONTH, year: YEAR, runBy: user._id });
  const entry1 = first.entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry1) throw new Error("Expected PayrollEntry for test staff after first run");

  assertEq(
    Number(entry1.redo_product_cost_deduction),
    REDO_COST,
    `PayrollEntry.redo_product_cost_deduction = ${REDO_COST}`
  );

  const expectedNet = calculateNetPayable(
    entry1.base_salary,
    entry1.deduction_amount,
    entry1.commission_total,
    entry1.redo_product_cost_deduction
  );
  assertEq(
    Number(entry1.net_payable),
    expectedNet,
    `net_payable reflects redo cut (${expectedNet})`
  );
  assert(
    Number(entry1.net_payable) ===
      Number(
        (
          Number(entry1.base_salary) -
          Number(entry1.deduction_amount) +
          Number(entry1.commission_total) -
          REDO_COST
        ).toFixed(2)
      ),
    "net = base − unpaid + commission − redo"
  );

  const linked = await RedoRequest.findById(redo._id);
  assert(
    String(linked.payroll_run_id) === String(first.run._id),
    "completed redo linked to payroll run"
  );

  const second = await runPayrollForMonth({ month: MONTH, year: YEAR, runBy: user._id });
  const entry2 = second.entries.find((e) => String(e.staff_id) === String(staff._id));
  if (!entry2) throw new Error("Expected PayrollEntry after draft re-run");

  assertEq(
    Number(entry2.redo_product_cost_deduction),
    REDO_COST,
    "draft re-run redo deduction still single amount (no double)"
  );
  assertEq(
    Number(entry2.net_payable),
    Number(entry1.net_payable),
    "draft re-run net_payable unchanged (no double cut)"
  );

  const stillOne = await RedoRequest.countDocuments({
    _id: redo._id,
    payroll_run_id: first.run._id,
  });
  assertEq(stillOne, 1, "same redo still linked once after re-run");

  await cleanup();
  console.log("\n[test] payroll redo month include + no double passed");
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
