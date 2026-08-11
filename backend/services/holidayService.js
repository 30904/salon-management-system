/**
 * Holiday list/create helpers — Attendance / Leave / Payroll Patch Guide Stage E.
 */
import Holiday from "../models/Holiday.js";
import { AppError } from "../utils/AppError.js";
import { normalize } from "./leaveClashService.js";

function monthDateRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * List holidays in a calendar month (company-wide + optional branch).
 */
export async function listHolidaysForMonth({ month, year, branchId = null }) {
  const monthNum = Number.parseInt(month, 10);
  const yearNum = Number.parseInt(year, 10);

  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new AppError("month must be an integer 1–12", 400);
  }
  if (!Number.isInteger(yearNum) || yearNum < 2000) {
    throw new AppError("year must be a valid calendar year", 400);
  }

  const { start, end } = monthDateRange(yearNum, monthNum);
  const filter = {
    is_active: true,
    date: { $gte: start, $lte: end },
  };

  if (branchId) {
    filter.$or = [{ branch_id: null }, { branch_id: branchId }];
  }

  const holidays = await Holiday.find(filter).sort({ date: 1 });
  return holidays.map((holiday) => holiday.toSafeObject());
}

/**
 * Admin adds a holiday date (UTC midnight). Unique per {date, branch_id}.
 */
export async function createHoliday({ date, name, branchId = null }) {
  if (!date) {
    throw new AppError("date is required", 400);
  }
  if (!name || !String(name).trim()) {
    throw new AppError("name is required", 400);
  }

  const normDate = normalize(date);
  if (Number.isNaN(normDate.getTime())) {
    throw new AppError("Invalid date", 400);
  }

  try {
    return await Holiday.create({
      date: normDate,
      name: String(name).trim(),
      branch_id: branchId || null,
      is_active: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("A holiday already exists for this date", 409);
    }
    throw error;
  }
}
