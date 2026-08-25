import StaffMonthlyTarget from "../models/StaffMonthlyTarget.js";
import { AppError } from "../utils/AppError.js";
import { getMyEarnings, getStaffProfileByUserId } from "./staffEarningsService.js";

export const DEFAULT_TARGET_1_MULTIPLIER = 5;
export const DEFAULT_TARGET_2_MULTIPLIER = 7;

function buildProgress(targetAmount, achievedAmount) {
  const target = Math.max(0, Number(targetAmount) || 0);
  const achieved = Math.max(0, Number(achievedAmount) || 0);
  const pending = Math.max(0, target - achieved);
  const percent = target > 0 ? Math.min(100, Math.round((achieved / target) * 1000) / 10) : 0;
  const completed = target > 0 && achieved >= target;

  return {
    target,
    achieved,
    pending,
    percent,
    completed,
  };
}

function resolveDefaultTargets(profile) {
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
    source: Number(profile?.monthly_target_1) > 0 || Number(profile?.monthly_target_2) > 0
      ? "profile"
      : "salary_multiplier",
  };
}

export async function getMyTargets(userId, query = {}) {
  const earnings = await getMyEarnings(userId, query);
  const { month, year } = earnings.period;
  const profile = earnings.staff
    ? await getStaffProfileByUserId(userId)
    : null;

  if (!profile) {
    return {
      staff: null,
      period: { month, year },
      metric: "sales",
      achieved: 0,
      source: null,
      target_1: buildProgress(0, 0),
      target_2: buildProgress(0, 0),
    };
  }

  const override = await StaffMonthlyTarget.findOne({
    staff_id: profile._id,
    month,
    year,
  }).lean();

  const defaults = resolveDefaultTargets(profile);
  const target1 = override ? Number(override.target_1_amount) : defaults.target_1_amount;
  const target2 = override
    ? Number(override.target_2_amount)
    : defaults.target_2_amount;
  const source = override ? "monthly_override" : defaults.source;
  const achieved = Number(earnings.summary?.sales_total) || 0;

  return {
    staff: earnings.staff,
    period: { month, year },
    metric: "sales",
    metric_label: "Service sales",
    achieved,
    base_salary: Number(profile.base_salary) || 0,
    source,
    target_1: buildProgress(target1, achieved),
    target_2: buildProgress(target2, achieved),
  };
}

export async function upsertStaffMonthlyTarget(staffId, payload, setByUserId = null) {
  const month = Number(payload.month);
  const year = Number(payload.year);
  const target1 = Number(payload.target_1_amount);
  const target2 = Number(payload.target_2_amount);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("month must be between 1 and 12", 400);
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("year must be a valid four-digit year", 400);
  }
  if (!Number.isFinite(target1) || target1 < 0 || !Number.isFinite(target2) || target2 < 0) {
    throw new AppError("target amounts must be non-negative numbers", 400);
  }

  const doc = await StaffMonthlyTarget.findOneAndUpdate(
    { staff_id: staffId, month, year },
    {
      staff_id: staffId,
      month,
      year,
      target_1_amount: target1,
      target_2_amount: target2,
      notes: payload.notes || null,
      set_by: setByUserId || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc.toSafeObject();
}
