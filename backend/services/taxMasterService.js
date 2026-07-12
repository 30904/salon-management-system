import mongoose from "mongoose";
import TaxMaster, { TAX_APPLIES_TO } from "../models/TaxMaster.js";
import { AppError } from "../utils/AppError.js";

function assertValidId(id, label = "tax id") {
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

function parseRate(value) {
  const rate = Number(value);

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new AppError("rate must be a number between 0 and 100", 400);
  }

  return rate;
}

function parseAppliesTo(value) {
  if (value === undefined) return undefined;

  const normalized = String(value).trim().toLowerCase();

  if (!TAX_APPLIES_TO.includes(normalized)) {
    throw new AppError(
      `applies_to must be one of: ${TAX_APPLIES_TO.join(", ")}`,
      400
    );
  }

  return normalized;
}

export async function getTaxById(taxId) {
  assertValidId(taxId);
  const tax = await TaxMaster.findById(taxId);

  if (!tax) {
    throw new AppError("Tax not found", 404);
  }

  return tax;
}

export async function listTaxes({ isActive, search, appliesTo } = {}) {
  const filter = {};
  const active = parseBoolean(isActive);
  const target = parseAppliesTo(appliesTo);

  if (active !== undefined) {
    filter.is_active = active;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  if (target) {
    if (target === "both") {
      filter.applies_to = "both";
    } else {
      filter.applies_to = { $in: [target, "both"] };
      if (active === undefined) {
        filter.is_active = true;
      }
    }
  }

  return TaxMaster.find(filter).sort({ name: 1 });
}

export async function createTax({
  name,
  rate,
  applies_to = "both",
  is_active = true,
}) {
  if (!name?.trim()) {
    throw new AppError("name is required", 400);
  }

  return TaxMaster.create({
    name: name.trim(),
    rate: parseRate(rate),
    applies_to: parseAppliesTo(applies_to),
    is_active: parseBoolean(is_active),
  });
}

export async function updateTax(taxId, updates = {}) {
  const tax = await getTaxById(taxId);

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    tax.name = String(updates.name).trim();
  }

  if (updates.rate !== undefined) {
    tax.rate = parseRate(updates.rate);
  }

  if (updates.applies_to !== undefined) {
    tax.applies_to = parseAppliesTo(updates.applies_to);
  }

  if (updates.is_active !== undefined) {
    tax.is_active = parseBoolean(updates.is_active);
  }

  await tax.save();
  return tax;
}

export async function deactivateTax(taxId) {
  return updateTax(taxId, { is_active: false });
}
