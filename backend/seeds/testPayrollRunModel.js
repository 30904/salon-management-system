/**
 * Payroll Stage C test (tracker row 18):
 * PayrollRun model — month, year, status draft|finalized, run_by, finalized_at.
 *
 * Usage:
 *   npm run test:payroll-run-model
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import PayrollRun, { PAYROLL_RUN_STATUSES } from "../models/PayrollRun.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_MONTH = 8;
const TEST_YEAR = 2099; // far-future sentinel to avoid clashing with real runs

async function cleanup() {
  await PayrollRun.deleteMany({ month: TEST_MONTH, year: TEST_YEAR });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — PayrollRun model\n");

  await cleanup();

  const run = await PayrollRun.create({
    month: TEST_MONTH,
    year: TEST_YEAR,
    status: "draft",
    run_by: new mongoose.Types.ObjectId(),
  });

  if (run.status !== "draft") {
    throw new Error("Expected default/create status draft");
  }
  if (run.finalized_at != null) {
    throw new Error("Expected finalized_at default null");
  }
  console.log("  PASS: PayrollRun created with draft status and null finalized_at");

  const safe = run.toSafeObject();
  if (safe.month !== TEST_MONTH || safe.year !== TEST_YEAR) {
    throw new Error("toSafeObject month/year mismatch");
  }
  if (!PAYROLL_RUN_STATUSES.includes("draft") || !PAYROLL_RUN_STATUSES.includes("finalized")) {
    throw new Error("Expected PAYROLL_RUN_STATUSES draft|finalized");
  }
  console.log("  PASS: toSafeObject + status enum draft|finalized");

  run.status = "finalized";
  run.finalized_at = new Date();
  await run.save();

  const reloaded = await PayrollRun.findById(run._id);
  if (reloaded.status !== "finalized" || !reloaded.finalized_at) {
    throw new Error("Expected finalized status and finalized_at set");
  }
  console.log("  PASS: status can move to finalized with finalized_at");

  await cleanup();
  console.log("\n[test] PayrollRun model passed");
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
