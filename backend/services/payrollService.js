/**
 * Direct-pay payroll engine — Attendance / Leave / Payroll Patch Guide Stage D.
 *
 * net = base_salary − (per_day_rate × unpaidDays) + commission_total
 * per_day_rate = base_salary / workingDaysInMonth (holidays excluded from denominator)
 */
import mongoose from "mongoose";
import CommissionEntry from "../models/CommissionEntry.js";
import PayrollEntry from "../models/PayrollEntry.js";
import PayrollRun from "../models/PayrollRun.js";
import { AppError } from "../utils/AppError.js";
import { getMonthlyAttendanceSummary } from "./attendanceSummaryService.js";

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
 * net = base_salary − deduction + commission_total
 */
export function calculateNetPayable(baseSalary, deductionAmount, commissionTotal) {
  return Number(
    (Number(baseSalary || 0) - Number(deductionAmount || 0) + Number(commissionTotal || 0)).toFixed(2)
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
 * Upsert a draft PayrollRun for month/year and rebuild PayrollEntry rows
 * for every active staff from attendance summary + accrued commissions.
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
  const entries = [];

  for (const staffSummary of summary.payroll_summaries) {
    const staffId = staffSummary.staff_id;
    const baseSalary = Number(staffSummary.base_salary || 0);
    const workingDays = Number(staffSummary.working_days_in_month || 0);
    const payableDays = Number(staffSummary.payable_days || 0);
    const unpaidDays = Number(staffSummary.unpaid_days || 0);

    const perDayRate = calculatePerDayRate(baseSalary, workingDays);
    const deductionAmount = calculateDeductionAmount(perDayRate, unpaidDays);

    // Accrued this month, or already linked to this draft run (safe re-calc)
    const commissions = await CommissionEntry.find({
      staff_id: staffId,
      calculated_at: { $gte: start, $lte: end },
      $or: [
        { status: "accrued" },
        { status: "paid", payroll_run_id: run._id },
      ],
    });

    const commissionTotal = commissions.reduce(
      (sum, c) => sum + Number(c.commission_amount || 0),
      0
    );
    const netPayable = calculateNetPayable(baseSalary, deductionAmount, commissionTotal);

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
          commission_total: Number(commissionTotal.toFixed(2)),
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
