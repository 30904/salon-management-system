/**
 * Payroll Stage C test (tracker row 20):
 * Unique indexes — duplicate month/year run fails; duplicate staff in run fails.
 *
 * Usage:
 *   npm run test:payroll-unique
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

const TEST_MONTH = 10;
const TEST_YEAR = 2099;

async function cleanup() {
  const runs = await PayrollRun.find({ month: TEST_MONTH, year: TEST_YEAR }).select("_id");
  const runIds = runs.map((r) => r._id);
  if (runIds.length) {
    await PayrollEntry.deleteMany({ payroll_run_id: { $in: runIds } });
  }
  await PayrollRun.deleteMany({ month: TEST_MONTH, year: TEST_YEAR });
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || String(error.message || "").includes("E11000");
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — PayrollRun / PayrollEntry unique indexes\n");

  await PayrollRun.syncIndexes();
  await PayrollEntry.syncIndexes();
  await cleanup();

  const run = await PayrollRun.create({
    month: TEST_MONTH,
    year: TEST_YEAR,
    status: "draft",
  });
  console.log(`  PASS: inserted PayrollRun ${run._id}`);

  let duplicateRunRejected = false;
  try {
    await PayrollRun.create({
      month: TEST_MONTH,
      year: TEST_YEAR,
      status: "draft",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      duplicateRunRejected = true;
      console.log("  PASS: duplicate {month, year} PayrollRun rejected (E11000)");
    } else {
      throw error;
    }
  }
  if (!duplicateRunRejected) {
    throw new Error("Expected duplicate month/year PayrollRun to fail");
  }

  const staffId = new mongoose.Types.ObjectId();
  const entryPayload = {
    payroll_run_id: run._id,
    staff_id: staffId,
    base_salary: 20000,
    working_days_in_month: 28,
    payable_days: 27,
    unpaid_days: 1,
    per_day_rate: 714.29,
    deduction_amount: 714,
    commission_total: 0,
    net_payable: 19286,
  };

  const entry = await PayrollEntry.create(entryPayload);
  console.log(`  PASS: inserted PayrollEntry ${entry._id}`);

  let duplicateEntryRejected = false;
  try {
    await PayrollEntry.create(entryPayload);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      duplicateEntryRejected = true;
      console.log("  PASS: duplicate {payroll_run_id, staff_id} rejected (E11000)");
    } else {
      throw error;
    }
  }
  if (!duplicateEntryRejected) {
    throw new Error("Expected duplicate staff in same PayrollRun to fail");
  }

  // Different staff in same run is allowed
  const other = await PayrollEntry.create({
    ...entryPayload,
    staff_id: new mongoose.Types.ObjectId(),
  });
  console.log(`  PASS: different staff in same run allowed (${other._id})`);

  await cleanup();
  console.log("\n[test] Payroll unique indexes passed");
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
