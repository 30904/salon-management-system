import mongoose from "mongoose";
import DiscountMaster from "../models/DiscountMaster.js";
import { AppError } from "../utils/AppError.js";
import {
  WEEKDAY_VALUES,
  isDiscountAvailableAt,
  parseHhMm,
} from "../constants/discountConstants.js";

function assertValidId(id, label = "discount id") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

function parseBoolean(value, label = "is_active") {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new AppError(`${label} must be true or false`, 400);
}

function parsePercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new AppError("percent must be a number between 0 and 100", 400);
  }
  return percent;
}

function parseDays(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("Select at least one weekday", 400);
  }

  const days = [...new Set(value.map((day) => Number(day)))];
  if (days.some((day) => !WEEKDAY_VALUES.includes(day))) {
    throw new AppError("days must be Monday=1 through Sunday=7", 400);
  }

  return days.sort((a, b) => a - b);
}

function parseTime(value, label) {
  const parsed = parseHhMm(value);
  if (!parsed) {
    throw new AppError(`${label} must be HH:mm`, 400);
  }
  const hour = String(parsed.hour).padStart(2, "0");
  const minute = String(parsed.minute).padStart(2, "0");
  return `${hour}:${minute}`;
}

export async function getDiscountById(discountId) {
  assertValidId(discountId);
  const discount = await DiscountMaster.findById(discountId);
  if (!discount) {
    throw new AppError("Discount type not found", 404);
  }
  return discount;
}

export async function listDiscounts({ isActive, search, availableNow } = {}) {
  const filter = {};
  const active = parseBoolean(isActive);

  if (active !== undefined) {
    filter.is_active = active;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  const discounts = await DiscountMaster.find(filter).sort({ name: 1 });

  if (availableNow === true || availableNow === "true") {
    return discounts.filter((discount) => isDiscountAvailableAt(discount));
  }

  return discounts;
}

export async function createDiscount({
  name,
  percent,
  days,
  start_time,
  end_time,
  is_active = true,
}) {
  if (!name?.trim()) {
    throw new AppError("name is required", 400);
  }

  return DiscountMaster.create({
    name: name.trim(),
    percent: parsePercent(percent),
    days: parseDays(days),
    start_time: parseTime(start_time, "start_time"),
    end_time: parseTime(end_time, "end_time"),
    is_active: parseBoolean(is_active) ?? true,
  });
}

export async function updateDiscount(discountId, updates = {}) {
  const discount = await getDiscountById(discountId);

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    discount.name = String(updates.name).trim();
  }

  if (updates.percent !== undefined) {
    discount.percent = parsePercent(updates.percent);
  }

  if (updates.days !== undefined) {
    discount.days = parseDays(updates.days);
  }

  if (updates.start_time !== undefined) {
    discount.start_time = parseTime(updates.start_time, "start_time");
  }

  if (updates.end_time !== undefined) {
    discount.end_time = parseTime(updates.end_time, "end_time");
  }

  if (updates.is_active !== undefined) {
    discount.is_active = parseBoolean(updates.is_active);
  }

  await discount.save();
  return discount;
}

export async function deactivateDiscount(discountId) {
  return updateDiscount(discountId, { is_active: false });
}

export async function resolveDiscountForBilling(discountId) {
  if (!discountId) return null;

  const discount = await getDiscountById(discountId);
  if (!discount.is_active) {
    throw new AppError("This discount type is inactive", 400);
  }
  if (!isDiscountAvailableAt(discount)) {
    throw new AppError(
      `"${discount.name}" is not available right now (day or time window)`,
      400
    );
  }

  return discount;
}
