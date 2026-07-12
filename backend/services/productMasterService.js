import mongoose from "mongoose";
import ProductMaster from "../models/ProductMaster.js";
import { AppError } from "../utils/AppError.js";

function assertValidId(id, label = "product id") {
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

function parseNonNegativeNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`${label} must be a non-negative number`, 400);
  }

  return number;
}

function normalizeSku(sku) {
  if (!sku?.trim()) {
    throw new AppError("sku is required", 400);
  }

  return sku.trim().toUpperCase();
}

export async function getProductById(productId) {
  assertValidId(productId);
  const product = await ProductMaster.findById(productId);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return product;
}

export async function listProducts({ isActive, search, lowStock } = {}) {
  const filter = {};
  const active = parseBoolean(isActive);
  const onlyLowStock = parseBoolean(lowStock, "low_stock");

  if (active !== undefined) {
    filter.is_active = active;
  }

  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { sku: { $regex: term, $options: "i" } },
    ];
  }

  if (onlyLowStock) {
    Object.assign(filter, ProductMaster.lowStockFilter());
    if (active === undefined) {
      filter.is_active = true;
    }
  }

  return ProductMaster.find(filter).sort({ name: 1 });
}

export async function listLowStockProducts() {
  return ProductMaster.find(ProductMaster.lowStockFilter()).sort({
    current_stock: 1,
    name: 1,
  });
}

export async function createProduct({
  name,
  sku,
  unit = "piece",
  purchase_price,
  sale_price,
  current_stock = 0,
  reorder_level = 0,
  is_active = true,
}) {
  if (!name?.trim()) {
    throw new AppError("name is required", 400);
  }

  if (!unit?.trim()) {
    throw new AppError("unit is required", 400);
  }

  return ProductMaster.create({
    name: name.trim(),
    sku: normalizeSku(sku),
    unit: unit.trim(),
    purchase_price: parseNonNegativeNumber(purchase_price, "purchase_price"),
    sale_price: parseNonNegativeNumber(sale_price, "sale_price"),
    current_stock: parseNonNegativeNumber(current_stock, "current_stock"),
    reorder_level: parseNonNegativeNumber(reorder_level, "reorder_level"),
    is_active: parseBoolean(is_active),
  });
}

export async function updateProduct(productId, updates = {}) {
  const product = await getProductById(productId);

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    product.name = String(updates.name).trim();
  }

  if (updates.sku !== undefined) {
    product.sku = normalizeSku(updates.sku);
  }

  if (updates.unit !== undefined) {
    if (!String(updates.unit).trim()) {
      throw new AppError("unit cannot be empty", 400);
    }
    product.unit = String(updates.unit).trim();
  }

  if (updates.purchase_price !== undefined) {
    product.purchase_price = parseNonNegativeNumber(
      updates.purchase_price,
      "purchase_price"
    );
  }

  if (updates.sale_price !== undefined) {
    product.sale_price = parseNonNegativeNumber(updates.sale_price, "sale_price");
  }

  if (updates.current_stock !== undefined) {
    product.current_stock = parseNonNegativeNumber(
      updates.current_stock,
      "current_stock"
    );
  }

  if (updates.reorder_level !== undefined) {
    product.reorder_level = parseNonNegativeNumber(
      updates.reorder_level,
      "reorder_level"
    );
  }

  if (updates.is_active !== undefined) {
    product.is_active = parseBoolean(updates.is_active);
  }

  await product.save();
  return product;
}

export async function deactivateProduct(productId) {
  return updateProduct(productId, { is_active: false });
}
