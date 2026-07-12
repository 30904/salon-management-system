import mongoose from "mongoose";
import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";
import { AppError } from "../utils/AppError.js";

function assertValidId(id, label) {
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

function parseDuration(value) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration < 5) {
    throw new AppError("duration_minutes must be an integer of at least 5", 400);
  }

  return duration;
}

function normalizeOptionalObjectId(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  assertValidId(value, label);
  return value;
}

export async function getServiceCategoryById(categoryId) {
  assertValidId(categoryId, "service category id");
  const category = await ServiceCategory.findById(categoryId);

  if (!category) {
    throw new AppError("Service category not found", 404);
  }

  return category;
}

export async function listServiceCategories({ isActive, search } = {}) {
  const filter = {};
  const active = parseBoolean(isActive);

  if (active !== undefined) {
    filter.is_active = active;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  return ServiceCategory.find(filter).sort({ name: 1 });
}

export async function createServiceCategory({ name, is_active = true }) {
  if (!name?.trim()) {
    throw new AppError("name is required", 400);
  }

  return ServiceCategory.create({
    name: name.trim(),
    is_active: parseBoolean(is_active),
  });
}

export async function updateServiceCategory(categoryId, updates = {}) {
  const category = await getServiceCategoryById(categoryId);

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    category.name = String(updates.name).trim();
  }

  if (updates.is_active !== undefined) {
    const nextActive = parseBoolean(updates.is_active);

    if (!nextActive) {
      const activeService = await ServiceMaster.exists({
        category_id: category._id,
        is_active: true,
      });

      if (activeService) {
        throw new AppError(
          "Deactivate services in this category before deactivating the category",
          409
        );
      }
    }

    category.is_active = nextActive;
  }

  await category.save();
  return category;
}

export async function deactivateServiceCategory(categoryId) {
  return updateServiceCategory(categoryId, { is_active: false });
}

export async function getServiceById(serviceId) {
  assertValidId(serviceId, "service id");
  const service = await ServiceMaster.populateForList(
    ServiceMaster.findById(serviceId)
  );

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  return service;
}

export async function listServices({
  categoryId,
  isActive,
  search,
} = {}) {
  const filter = {};
  const active = parseBoolean(isActive);

  if (categoryId) {
    assertValidId(categoryId, "category_id");
    filter.category_id = categoryId;
  }

  if (active !== undefined) {
    filter.is_active = active;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  return ServiceMaster.populateForList(
    ServiceMaster.find(filter).sort({ name: 1 })
  );
}

export async function createService({
  category_id,
  name,
  duration_minutes,
  price,
  commission_slab_override_id = null,
  is_active = true,
}) {
  if (!category_id) {
    throw new AppError("category_id is required", 400);
  }

  const category = await getServiceCategoryById(category_id);

  if (!category.is_active) {
    throw new AppError("Cannot add a service to an inactive category", 400);
  }

  if (!name?.trim()) {
    throw new AppError("name is required", 400);
  }

  const service = await ServiceMaster.create({
    category_id,
    name: name.trim(),
    duration_minutes: parseDuration(duration_minutes),
    price: parseNonNegativeNumber(price, "price"),
    commission_slab_override_id: normalizeOptionalObjectId(
      commission_slab_override_id,
      "commission_slab_override_id"
    ),
    is_active: parseBoolean(is_active),
  });

  return getServiceById(service._id);
}

export async function updateService(serviceId, updates = {}) {
  const service = await getServiceById(serviceId);

  if (updates.category_id !== undefined) {
    const category = await getServiceCategoryById(updates.category_id);

    if (!category.is_active) {
      throw new AppError("Cannot move a service to an inactive category", 400);
    }

    service.category_id = category._id;
  }

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    service.name = String(updates.name).trim();
  }

  if (updates.duration_minutes !== undefined) {
    service.duration_minutes = parseDuration(updates.duration_minutes);
  }

  if (updates.price !== undefined) {
    service.price = parseNonNegativeNumber(updates.price, "price");
  }

  if (updates.commission_slab_override_id !== undefined) {
    service.commission_slab_override_id = normalizeOptionalObjectId(
      updates.commission_slab_override_id,
      "commission_slab_override_id"
    );
  }

  if (updates.is_active !== undefined) {
    service.is_active = parseBoolean(updates.is_active);
  }

  await service.save();
  return getServiceById(service._id);
}

export async function deactivateService(serviceId) {
  return updateService(serviceId, { is_active: false });
}
