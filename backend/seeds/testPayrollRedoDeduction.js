/**
 * Feature 4 tracker row 13 — payroll redo product-cost deduction.
 *
 * Usage:
 *   npm run test:payroll-redo-deduction
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import RedoRequest from "../models/RedoRequest.js";
import {
  calculateNetPayable,
  sumRedoProductCostForStaff,
  linkRedoDeductionsToPayrollRun,
} from "../services/payrollService.js";
import { isRedoPayrollDeductionEnabled } from "../constants/redoConstants.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TAG = "payroll-redo-deduction-test";

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
  await RedoRequest.deleteMany({ reason: TAG });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — payroll redo deduction\n");

  await cleanup();

  assertEq(calculateNetPayable(10000, 500, 1000), 10500, "3-arg net still works");
  assertEq(calculateNetPayable(10000, 500, 1000, 250), 10250, "net subtracts redo cost");
  assert(
    isRedoPayrollDeductionEnabled() === false,
    "production gate is OFF (row 3)"
  );

  const staffId = new mongoose.Types.ObjectId();
  const runId = new mongoose.Types.ObjectId();
  const otherRunId = new mongoose.Types.ObjectId();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const r1 = await RedoRequest.create({
    original_invoice_id: new mongoose.Types.ObjectId(),
    original_line_item_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    original_staff_id: staffId,
    redo_staff_id: staffId,
    status: "completed",
    requested_by: new mongoose.Types.ObjectId(),
    reason: TAG,
    total_product_cost: 100,
    payroll_run_id: null,
  });
  const r2 = await RedoRequest.create({
    original_invoice_id: new mongoose.Types.ObjectId(),
    original_line_item_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    original_staff_id: staffId,
    redo_staff_id: staffId,
    status: "completed",
    requested_by: new mongoose.Types.ObjectId(),
    reason: TAG,
    total_product_cost: 50,
    payroll_run_id: null,
  });
  // Already linked to another run — must not be included
  await RedoRequest.create({
    original_invoice_id: new mongoose.Types.ObjectId(),
    original_line_item_id: new mongoose.Types.ObjectId(),
    customer_id: new mongoose.Types.ObjectId(),
    original_staff_id: staffId,
    redo_staff_id: staffId,
    status: "completed",
    requested_by: new mongoose.Types.ObjectId(),
    reason: TAG,
    total_product_cost: 999,
    payroll_run_id: otherRunId,
  });

  const gatedOff = await sumRedoProductCostForStaff({
    staffId,
    payrollRunId: runId,
    start,
    end,
    enabled: false,
  });
  assertEq(gatedOff.amount, 0, "gate OFF → amount 0");
  assertEq(gatedOff.redoIds.length, 0, "gate OFF → no redo ids claimed");

  const first = await sumRedoProductCostForStaff({
    staffId,
    payrollRunId: runId,
    start,
    end,
    enabled: true,
  });
  assertEq(first.amount, 150, "enabled → sum 100+50");
  assertEq(first.redoIds.length, 2, "enabled → 2 redo ids");

  await linkRedoDeductionsToPayrollRun(first.redoIds, runId);
  const linked1 = await RedoRequest.findById(r1._id);
  const linked2 = await RedoRequest.findById(r2._id);
  assert(String(linked1.payroll_run_id) === String(runId), "r1 linked to run");
  assert(String(linked2.payroll_run_id) === String(runId), "r2 linked to run");

  // Draft recompute: same run still sees linked redos, does not double after second link
  const second = await sumRedoProductCostForStaff({
    staffId,
    payrollRunId: runId,
    start,
    end,
    enabled: true,
  });
  assertEq(second.amount, 150, "draft recompute same total (no double)");
  assertEq(second.redoIds.length, 2, "draft recompute same 2 ids");

  await linkRedoDeductionsToPayrollRun(second.redoIds, runId);
  const still = await sumRedoProductCostForStaff({
    staffId,
    payrollRunId: runId,
    start,
    end,
    enabled: true,
  });
  assertEq(still.amount, 150, "after re-link still 150 not 300");

  // Different draft run must not pick already-linked redos
  const otherDraft = await sumRedoProductCostForStaff({
    staffId,
    payrollRunId: new mongoose.Types.ObjectId(),
    start,
    end,
    enabled: true,
  });
  assertEq(otherDraft.amount, 0, "other run does not steal linked redos");

  await cleanup();
  console.log("\n[test] payroll redo deduction passed");
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
