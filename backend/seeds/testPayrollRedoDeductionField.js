/**
 * Feature 4 tracker row 7 — PayrollEntry.redo_product_cost_deduction.
 *
 * Usage:
 *   npm run test:payroll-redo-deduction-field
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_MONTH = 7;
const TEST_YEAR = 2098;

async function cleanup() {
  const runs = await PayrollRun.find({ month: TEST_MONTH, year: TEST_YEAR }).select("_id");
  const runIds = runs.map((r) => r._id);
  if (runIds.length) {
    await PayrollEntry.deleteMany({ payroll_run_id: { $in: runIds } });
    await PayrollRun.deleteMany({ _id: { $in: runIds } });
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — PayrollEntry.redo_product_cost_deduction\n");

  await cleanup();

  const run = await PayrollRun.create({
    month: TEST_MONTH,
    year: TEST_YEAR,
    status: "draft",
  });

  const entry = await PayrollEntry.create({
    payroll_run_id: run._id,
    staff_id: new mongoose.Types.ObjectId(),
    base_salary: 10000,
    working_days_in_month: 26,
    payable_days: 26,
    unpaid_days: 0,
    per_day_rate: 384.6154,
    deduction_amount: 0,
    commission_total: 0,
    net_payable: 10000,
  });

  if ((entry.redo_product_cost_deduction ?? 0) !== 0) {
    throw new Error("Expected redo_product_cost_deduction default 0");
  }
  const safe = entry.toSafeObject();
  if (safe.redo_product_cost_deduction !== 0) {
    throw new Error("toSafeObject should expose redo_product_cost_deduction: 0");
  }
  console.log("  PASS: default 0 + toSafeObject");

  entry.redo_product_cost_deduction = 250;
  await entry.save();
  const reloaded = await PayrollEntry.findById(entry._id);
  if (reloaded.redo_product_cost_deduction !== 250) {
    throw new Error("redo_product_cost_deduction did not persist");
  }
  console.log("  PASS: field persists");

  await cleanup();
  console.log("\n[test] PayrollEntry.redo_product_cost_deduction passed");
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
