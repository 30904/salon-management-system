/**
 * Direct-pay payroll engine — Attendance / Leave / Payroll Patch Guide Stage D.
 *
 * net = base_salary − (per_day_rate × unpaidDays) + commission_total − redo_product_cost_deduction
 * commission_total = line commissions (non-percentage) + target bonuses
 *   Staff: T1 hit → +10% of Target 1; T2 hit → +10% of Target 2 only
 *   Manager: salon sales ≥ ₹9L → +1% of salon sales; ≥ ₹12L → +2% of salon sales
 * redo_product_cost_deduction: completed RedoRequests for redo_staff (gate REDO_PAYROLL_DEDUCTION_ENABLED)
 * per_day_rate = base_salary / workingDaysInMonth (holidays excluded from denominator)
 */
import mongoose from "mongoose";
import CommissionEntry from "../models/CommissionEntry.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import RedoRequest from "../models/RedoRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";
import { isRedoPayrollDeductionEnabled } from "../constants/redoConstants.js";
import { getMonthlyAttendanceSummary } from "./attendanceSummaryService.js";
import {
  getSalonSalesAchievedForMonth,
  resolveTargetCommissionForStaff,
} from "./targetCommissionService.js";

function monthDateRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * per_day_rate = base_salary / workingDaysInMonth
 * workingDaysInMonth already excludes holidays (Stage B).
 */
export function calculatePerDayRate(baseSalary, workingDaysInMonth) {
  const salary = Number(baseSalary || 0);
  const days = Number(workingDaysInMonth || 0);
  if (days <= 0) return 0;
  return Number((salary / days).toFixed(4));
}

/**
 * deduction = round(perDayRate × unpaidDays)
 */
export function calculateDeductionAmount(perDayRate, unpaidDays) {
  return Math.round(Number(perDayRate || 0) * Number(unpaidDays || 0));
}

/**
 * net = base_salary − attendanceDeduction + commission_total − redoProductCostDeduction
 */
export function calculateNetPayable(
  baseSalary,
  deductionAmount,
  commissionTotal,
  redoProductCostDeduction = 0
) {
  return Number(
    (
      Number(baseSalary || 0) -
      Number(deductionAmount || 0) +
      Number(commissionTotal || 0) -
      Number(redoProductCostDeduction || 0)
    ).toFixed(2)
  );
}

/**
 * Mark commission rows as paid and attach them to a payroll run
 * so they are not picked up again next month.
 */
export async function linkCommissionsToPayrollRun(commissionIds, payrollRunId) {
  if (!commissionIds?.length) return { modifiedCount: 0 };

  const result = await CommissionEntry.updateMany(
    { _id: { $in: commissionIds } },
    { $set: { status: "paid", payroll_run_id: payrollRunId } }
  );

  return { modifiedCount: result.modifiedCount || 0 };
}

/**
 * Attach completed redo costs to a payroll run (idempotency for draft recompute).
 */
export async function linkRedoDeductionsToPayrollRun(redoIds, payrollRunId) {
  if (!redoIds?.length) return { modifiedCount: 0 };

  // timestamps: false — keep updatedAt (month attribution) stable on draft recompute
  const result = await RedoRequest.updateMany(
    { _id: { $in: redoIds } },
    { $set: { payroll_run_id: payrollRunId } },
    { timestamps: false }
  );

  return { modifiedCount: result.modifiedCount || 0 };
}

/**
 * Sum completed redo product costs for one staff in a payroll month.
 * Includes unlinked redos and redos already linked to this draft run (safe re-calc).
 * When payroll gate is OFF, returns 0 and does not claim redo rows.
 *
 * @param {{ staffId: string, payrollRunId: string, start: Date, end: Date, enabled?: boolean }} opts
 */
export async function sumRedoProductCostForStaff({
  staffId,
  payrollRunId,
  start,
  end,
  enabled = isRedoPayrollDeductionEnabled(),
} = {}) {
  if (!enabled) {
    return { amount: 0, redoIds: [] };
  }

  const redos = await RedoRequest.find({
    redo_staff_id: staffId,
    status: "completed",
    updatedAt: { $gte: start, $lte: end },
    $or: [{ payroll_run_id: null }, { payroll_run_id: payrollRunId }],
  }).select("_id total_product_cost");

  const amount = Number(
    redos.reduce((sum, row) => sum + Number(row.total_product_cost || 0), 0).toFixed(2)
  );

  return {
    amount,
    redoIds: redos.map((row) => row._id),
  };
}

/**
 * Upsert a draft PayrollRun for month/year and rebuild PayrollEntry rows
 * for every active staff from attendance summary + line commissions + target bonuses + redo costs.
 *
 * @param {{ month: number, year: number, runBy?: import("mongoose").Types.ObjectId|null }} opts
 */
export async function runPayrollForMonth({ month, year, runBy = null }) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("month must be an integer 1–12", 400);
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new AppError("year must be a valid calendar year", 400);
  }

  let run = await PayrollRun.findOne({ month, year });
  if (run?.status === "finalized") {
    throw new AppError("Payroll run is finalized and cannot be recalculated", 400);
  }

  if (!run) {
    run = await PayrollRun.create({
      month,
      year,
      status: "draft",
      run_by: runBy,
    });
  } else if (runBy) {
    run.run_by = runBy;
    await run.save();
  }

  const summary = await getMonthlyAttendanceSummary({ year, month });
  const { start, end } = monthDateRange(year, month);
  const periodStart = new Date(year, month - 1, 1);
  const periodEndExclusive = new Date(year, month, 1);
  const salonSalesAchieved = await getSalonSalesAchievedForMonth(
    periodStart,
    periodEndExclusive
  );
  const entries = [];

  for (const staffSummary of summary.payroll_summaries) {
    const staffId = staffSummary.staff_id;
    const baseSalary = Number(staffSummary.base_salary || 0);
    const workingDays = Number(staffSummary.working_days_in_month || 0);
    const payableDays = Number(staffSummary.payable_days || 0);
    const unpaidDays = Number(staffSummary.unpaid_days || 0);

    const perDayRate = calculatePerDayRate(baseSalary, workingDays);
    const deductionAmount = calculateDeductionAmount(perDayRate, unpaidDays);

    // Accrued this month, or already linked to this draft run (safe re-calc).
    // Percentage slabs are excluded — salon 10% is paid via target-hit bonuses instead.
    const commissions = await CommissionEntry.find({
      staff_id: staffId,
      calculated_at: { $gte: start, $lte: end },
      slab_type: { $nin: ["percentage"] },
      $or: [
        { status: "accrued" },
        { status: "paid", payroll_run_id: run._id },
      ],
    });

    const lineCommissionTotal = commissions.reduce(
      (sum, c) => sum + Number(c.commission_amount || 0),
      0
    );

    const targetBonus = await resolveTargetCommissionForStaff({
      staffId,
      month,
      year,
      salonSalesAchieved,
    });

    const commissionTotal = Number(
      (lineCommissionTotal + targetBonus.target_commission_total).toFixed(2)
    );

    const redoDeduction = await sumRedoProductCostForStaff({
      staffId,
      payrollRunId: run._id,
      start,
      end,
    });
    const redoProductCostDeduction = redoDeduction.amount;

    const netPayable = calculateNetPayable(
      baseSalary,
      deductionAmount,
      commissionTotal,
      redoProductCostDeduction
    );

    const entry = await PayrollEntry.findOneAndUpdate(
      { payroll_run_id: run._id, staff_id: staffId },
      {
        $set: {
          base_salary: baseSalary,
          working_days_in_month: workingDays,
          payable_days: payableDays,
          unpaid_days: unpaidDays,
          per_day_rate: Number(perDayRate.toFixed(2)),
          deduction_amount: deductionAmount,
          redo_product_cost_deduction: redoProductCostDeduction,
          line_commission_total: Number(lineCommissionTotal.toFixed(2)),
          sales_achieved: targetBonus.sales_achieved,
          target_1_amount: targetBonus.target_1_amount,
          target_2_amount: targetBonus.target_2_amount,
          target_1_hit: targetBonus.target_1_hit,
          target_2_hit: targetBonus.target_2_hit,
          target_1_bonus: targetBonus.target_1_bonus,
          target_2_bonus: targetBonus.target_2_bonus,
          target_commission_total: targetBonus.target_commission_total,
          bonus_basis: targetBonus.bonus_basis || "staff_target",
          commission_total: commissionTotal,
          net_payable: netPayable,
        },
        $setOnInsert: {
          payroll_run_id: run._id,
          staff_id: staffId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (commissions.length) {
      await linkCommissionsToPayrollRun(
        commissions.map((c) => c._id),
        run._id
      );
    }

    if (redoDeduction.redoIds.length) {
      await linkRedoDeductionsToPayrollRun(redoDeduction.redoIds, run._id);
    }

    entries.push(entry);
  }

  return { run, entries, summary };
}

/**
 * Lock a payroll run: status finalized + finalized_at.
 * Further runPayrollForMonth calls for that month/year are rejected.
 *
 * @param {import("mongoose").Types.ObjectId|string} payrollRunId
 */
export async function finalizePayrollRun(payrollRunId) {
  if (!payrollRunId || !mongoose.Types.ObjectId.isValid(String(payrollRunId))) {
    throw new AppError("Invalid payroll run id", 400);
  }

  const run = await PayrollRun.findById(payrollRunId);
  if (!run) {
    throw new AppError("Payroll run not found", 404);
  }
  if (run.status === "finalized") {
    throw new AppError("Payroll run is already finalized", 400);
  }

  run.status = "finalized";
  run.finalized_at = new Date();
  await run.save();

  return run;
}

const STAFF_POPULATE = {
  path: "staff_id",
  select: "designation user_id",
  populate: { path: "user_id", select: "name" },
};

function formatEntryWithStaff(entry) {
  const staff = entry.staff_id;
  const user = staff?.user_id;
  return {
    ...entry.toSafeObject(),
    staff_name: user?.name || null,
    designation: staff?.designation || null,
  };
}

/**
 * Run + entries with staff name / designation for GET /api/payroll/run/:id
 */
export async function getPayrollRunWithEntries(payrollRunId) {
  if (!payrollRunId || !mongoose.Types.ObjectId.isValid(String(payrollRunId))) {
    throw new AppError("Invalid payroll run id", 400);
  }

  const run = await PayrollRun.findById(payrollRunId);
  if (!run) {
    throw new AppError("Payroll run not found", 404);
  }

  const entries = await PayrollEntry.find({ payroll_run_id: run._id })
    .populate(STAFF_POPULATE)
    .sort({ createdAt: 1 });

  return {
    run: run.toSafeObject(),
    entries: entries.map(formatEntryWithStaff),
  };
}

/**
 * Employee payslip for MyEarnings — GET /api/payroll/staff/:staffId
 */
export async function getStaffPayslip({ staffId, month, year }) {
  if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
    throw new AppError("Invalid staff id", 400);
  }

  const monthNum = Number.parseInt(month, 10);
  const yearNum = Number.parseInt(year, 10);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new AppError("month must be an integer 1–12", 400);
  }
  if (!Number.isInteger(yearNum) || yearNum < 2000) {
    throw new AppError("year must be a valid calendar year", 400);
  }

  const staff = await StaffProfile.findById(staffId).populate("user_id", "name");
  if (!staff) {
    throw new AppError("Staff profile not found", 404);
  }

  const staffInfo = {
    id: staff._id,
    name: staff.user_id?.name || null,
    designation: staff.designation,
  };

  const run = await PayrollRun.findOne({ month: monthNum, year: yearNum });
  if (!run) {
    return { run: null, entry: null, staff: staffInfo };
  }

  const entry = await PayrollEntry.findOne({
    payroll_run_id: run._id,
    staff_id: staff._id,
  }).populate(STAFF_POPULATE);

  return {
    run: run.toSafeObject(),
    entry: entry ? formatEntryWithStaff(entry) : null,
    staff: staffInfo,
  };
}
