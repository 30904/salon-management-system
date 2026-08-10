/**
 * Payroll Stage C test (tracker row 19):
 * PayrollEntry model — run+staff amounts for direct-pay payroll.
 *
 * Usage:
 *   npm run test:payroll-entry-model
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import PayrollRun from "../models/PayrollRun.js";
import PayrollEntry from "../models/PayrollEntry.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_MONTH = 9;
const TEST_YEAR = 2099;

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
  console.log("[test] Connected — PayrollEntry model\n");

  await cleanup();

  const run = await PayrollRun.create({
    month: TEST_MONTH,
    year: TEST_YEAR,
    status: "draft",
  });

  const staffId = new mongoose.Types.ObjectId();
  const entry = await PayrollEntry.create({
    payroll_run_id: run._id,
    staff_id: staffId,
    base_salary: 30000,
    working_days_in_month: 28,
    payable_days: 26.5,
    unpaid_days: 1.5,
    per_day_rate: 1071.43,
    deduction_amount: 1607,
    commission_total: 2500,
    net_payable: 30893,
  });

  const safe = entry.toSafeObject();
  if (String(safe.payroll_run_id) !== String(run._id)) {
    throw new Error("Expected payroll_run_id on entry");
  }
  if (safe.base_salary !== 30000 || safe.net_payable !== 30893) {
    throw new Error("Expected salary/net fields on toSafeObject");
  }
  console.log("  PASS: PayrollEntry created with all Stage C amount fields");

  const required = [
    "working_days_in_month",
    "payable_days",
    "unpaid_days",
    "per_day_rate",
    "deduction_amount",
    "commission_total",
    "net_payable",
  ];
  for (const key of required) {
    if (safe[key] === undefined || safe[key] === null) {
      throw new Error(`Missing field on toSafeObject: ${key}`);
    }
  }
  console.log("  PASS: toSafeObject exposes all payroll amount fields");

  await cleanup();
  console.log("\n[test] PayrollEntry model passed");
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
