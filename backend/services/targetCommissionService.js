/**
 * Target-hit commission bonuses for payroll.
 *
 * Staff: 10% of personal Target 1 when T1 hit (and T2 not); 10% of Target 2 only when T2 hit.
 * Raksha only: bonus from whole-salon monthly sales — 1% at ₹9L, 2% at ₹12L (higher tier replaces lower).
 */
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import StaffMonthlyTarget from "../models/StaffMonthlyTarget.js";
import StaffProfile from "../models/StaffProfile.js";
import {
  TARGET_COMMISSION_RATE,
  SALON_BONUS_STAFF_NAME_MATCH,
  MANAGER_SALON_TARGET_1,
  MANAGER_SALON_TARGET_2,
  MANAGER_SALON_RATE_1,
  MANAGER_SALON_RATE_2,
} from "../constants/payrollConstants.js";
import {
  DEFAULT_TARGET_1_MULTIPLIER,
  DEFAULT_TARGET_2_MULTIPLIER,
} from "./staffTargetsService.js";
import { AppError } from "../utils/AppError.js";

export const BONUS_BASIS_STAFF = "staff_target";
export const BONUS_BASIS_MANAGER = "manager_salon";

/**
 * Pure calculator — used by payroll and unit tests.
 *
 * - Sales ≥ T1 and < T2 → 10% of Target 1 only
 * - Sales ≥ T2 → 10% of Target 2 only (not T1 + T2)
 */
export function calculateTargetCommissionBonuses({
  salesAchieved,
  target1Amount,
  target2Amount,
  rate = TARGET_COMMISSION_RATE,
} = {}) {
  const achieved = Math.max(0, Number(salesAchieved) || 0);
  const t1 = Math.max(0, Number(target1Amount) || 0);
  const t2 = Math.max(0, Number(target2Amount) || 0);
  const r = Number(rate);

  const target2Hit = t2 > 0 && achieved >= t2;
  const target1Hit = !target2Hit && t1 > 0 && achieved >= t1;

  const target1Bonus = target1Hit ? Number((t1 * r).toFixed(2)) : 0;
  const target2Bonus = target2Hit ? Number((t2 * r).toFixed(2)) : 0;

  return {
    sales_achieved: Number(achieved.toFixed(2)),
    target_1_amount: Number(t1.toFixed(2)),
    target_2_amount: Number(t2.toFixed(2)),
    target_1_hit: target1Hit,
    target_2_hit: target2Hit,
    target_1_bonus: target1Bonus,
    target_2_bonus: target2Bonus,
    target_commission_total: Number((target1Bonus + target2Bonus).toFixed(2)),
    rate: r,
    bonus_basis: BONUS_BASIS_STAFF,
  };
}

/**
 * Raksha's bonus from whole-salon monthly sales (not personal service lines).
 *
 * - Salon ≥ ₹9L and < ₹12L → 1% of salon sales
 * - Salon ≥ ₹12L → 2% of salon sales (replaces 1%)
 */
export function calculateManagerSalonBonus({
  salonSales,
  target1Amount = MANAGER_SALON_TARGET_1,
  target2Amount = MANAGER_SALON_TARGET_2,
  rate1 = MANAGER_SALON_RATE_1,
  rate2 = MANAGER_SALON_RATE_2,
} = {}) {
  const achieved = Math.max(0, Number(salonSales) || 0);
  const t1 = Math.max(0, Number(target1Amount) || 0);
  const t2 = Math.max(0, Number(target2Amount) || 0);
  const r1 = Number(rate1);
  const r2 = Number(rate2);

  const target2Hit = t2 > 0 && achieved >= t2;
  const target1Hit = !target2Hit && t1 > 0 && achieved >= t1;

  const target1Bonus = target1Hit ? Number((achieved * r1).toFixed(2)) : 0;
  const target2Bonus = target2Hit ? Number((achieved * r2).toFixed(2)) : 0;

  return {
    sales_achieved: Number(achieved.toFixed(2)),
    target_1_amount: Number(t1.toFixed(2)),
    target_2_amount: Number(t2.toFixed(2)),
    target_1_hit: target1Hit,
    target_2_hit: target2Hit,
    target_1_bonus: target1Bonus,
    target_2_bonus: target2Bonus,
    target_commission_total: Number((target1Bonus + target2Bonus).toFixed(2)),
    rate: target2Hit ? r2 : target1Hit ? r1 : 0,
    bonus_basis: BONUS_BASIS_MANAGER,
  };
}

/**
 * Salon-sales bonus only for Raksha (by User.name), not Mansi / Front Manager.
 */
export function isManagerForSalonBonus(profile, userName) {
  const name = String(userName || profile?.user_id?.name || "").trim().toLowerCase();
  const match = String(SALON_BONUS_STAFF_NAME_MATCH || "").trim().toLowerCase();
  return Boolean(match) && name.includes(match);
}

function resolveDefaultTargetAmounts(profile) {
  const salary = Number(profile?.base_salary) || 0;
  const target1 =
    Number(profile?.monthly_target_1) > 0
      ? Number(profile.monthly_target_1)
      : salary * DEFAULT_TARGET_1_MULTIPLIER;
  const target2 =
    Number(profile?.monthly_target_2) > 0
      ? Number(profile.monthly_target_2)
      : salary * DEFAULT_TARGET_2_MULTIPLIER;

  return {
    target_1_amount: target1,
    target_2_amount: Math.max(target1, target2),
  };
}

/**
 * Resolve T1/T2 amounts for a staff+month (monthly override → profile → salary×5/7).
 */
export async function getStaffTargetAmountsForMonth(staffId, month, year) {
  if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
    throw new AppError("Invalid staff id", 400);
  }

  const profile = await StaffProfile.findById(staffId).select(
    "base_salary monthly_target_1 monthly_target_2"
  );
  if (!profile) {
    throw new AppError("Staff profile not found", 404);
  }

  const override = await StaffMonthlyTarget.findOne({
    staff_id: staffId,
    month,
    year,
  }).lean();

  if (override) {
    return {
      target_1_amount: Number(override.target_1_amount) || 0,
      target_2_amount: Number(override.target_2_amount) || 0,
      source: "monthly_override",
    };
  }

  const defaults = resolveDefaultTargetAmounts(profile);
  return {
    ...defaults,
    source:
      Number(profile.monthly_target_1) > 0 || Number(profile.monthly_target_2) > 0
        ? "profile"
        : "salary_multiplier",
  };
}

/**
 * Sales used for staff target progress — non-void invoice lines assigned to the staff
 * in the calendar month (same window as My Earnings).
 */
export async function getStaffSalesAchievedForMonth(staffId, start, endExclusive) {
  const rows = await InvoiceLineItem.aggregate([
    {
      $match: {
        staff_id: new mongoose.Types.ObjectId(String(staffId)),
      },
    },
    {
      $lookup: {
        from: "invoices",
        localField: "invoice_id",
        foreignField: "_id",
        as: "invoice",
      },
    },
    { $unwind: "$invoice" },
    {
      $match: {
        "invoice.billing_date": { $gte: start, $lt: endExclusive },
        "invoice.payment_status": { $ne: "void" },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$total_amount", 0] } },
      },
    },
  ]);

  return Number(rows[0]?.total || 0);
}

/**
 * Whole-salon monthly sales — sum of non-void invoice grand totals.
 */
export async function getSalonSalesAchievedForMonth(start, endExclusive) {
  const rows = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lt: endExclusive },
        payment_status: { $ne: "void" },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$totals.grand_total", 0] } },
      },
    },
  ]);

  return Number(rows[0]?.total || 0);
}

/**
 * Full target-bonus package for one staff in a payroll month.
 * Raksha uses salon-wide sales; everyone else uses personal service sales.
 *
 * @param {{ staffId: string, month: number, year: number, salonSalesAchieved?: number, rate?: number }} opts
 */
export async function resolveTargetCommissionForStaff({
  staffId,
  month,
  year,
  salonSalesAchieved = null,
  rate = TARGET_COMMISSION_RATE,
}) {
  if (!staffId || !mongoose.Types.ObjectId.isValid(String(staffId))) {
    throw new AppError("Invalid staff id", 400);
  }

  const profile = await StaffProfile.findById(staffId)
    .select("designation user_id")
    .populate({ path: "user_id", select: "name" });

  if (!profile) {
    throw new AppError("Staff profile not found", 404);
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEndExclusive = new Date(year, month, 1);

  if (isManagerForSalonBonus(profile, profile.user_id?.name)) {
    const salonSales =
      salonSalesAchieved != null
        ? Number(salonSalesAchieved)
        : await getSalonSalesAchievedForMonth(periodStart, periodEndExclusive);

    return {
      ...calculateManagerSalonBonus({ salonSales }),
      source: "manager_salon_sales",
    };
  }

  const targets = await getStaffTargetAmountsForMonth(staffId, month, year);
  const salesAchieved = await getStaffSalesAchievedForMonth(
    staffId,
    periodStart,
    periodEndExclusive
  );

  const bonuses = calculateTargetCommissionBonuses({
    salesAchieved,
    target1Amount: targets.target_1_amount,
    target2Amount: targets.target_2_amount,
    rate,
  });

  return {
    ...bonuses,
    source: targets.source,
  };
}

export default {
  calculateTargetCommissionBonuses,
  calculateManagerSalonBonus,
  isManagerForSalonBonus,
  getStaffTargetAmountsForMonth,
  getStaffSalesAchievedForMonth,
  getSalonSalesAchievedForMonth,
  resolveTargetCommissionForStaff,
};
