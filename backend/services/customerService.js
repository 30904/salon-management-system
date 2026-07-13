import mongoose from "mongoose";
import Customer, {
  CUSTOMER_GENDERS,
  CUSTOMER_TAG_TYPES,
} from "../models/Customer.js";
import StaffProfile from "../models/StaffProfile.js";
import CustomerPackage from "../models/CustomerPackage.js";
import { AppError } from "../utils/AppError.js";

function assertValidId(id, label = "customer id") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

function parseOptionalDate(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} must be a valid date`, 400);
  }

  return date;
}

function parseGender(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const normalized = String(value).trim().toLowerCase();

  if (!CUSTOMER_GENDERS.includes(normalized)) {
    throw new AppError(
      `gender must be one of: ${CUSTOMER_GENDERS.join(", ")}`,
      400
    );
  }

  return normalized;
}

function normalizePhone(phone) {
  if (!phone?.trim()) {
    throw new AppError("phone is required", 400);
  }

  return phone.trim();
}

function normalizeTags(tags) {
  if (tags === undefined) return undefined;

  if (!Array.isArray(tags)) {
    throw new AppError("tags must be an array", 400);
  }

  return tags.map((tag) => {
    const label = String(tag.label || tag).trim();

    if (!label) {
      throw new AppError("Each tag requires a label", 400);
    }

    const type = tag.type ? String(tag.type).trim().toLowerCase() : "manual";

    if (!CUSTOMER_TAG_TYPES.includes(type)) {
      throw new AppError(
        `tag type must be one of: ${CUSTOMER_TAG_TYPES.join(", ")}`,
        400
      );
    }

    return { label, type };
  });
}

async function resolvePreferredStylist(stylistId) {
  if (stylistId === undefined) return undefined;
  if (stylistId === null || stylistId === "") return null;

  assertValidId(stylistId, "preferred_stylist_id");
  const stylist = await StaffProfile.findById(stylistId);

  if (!stylist || !stylist.is_active) {
    throw new AppError("Preferred stylist not found", 404);
  }

  return stylist._id;
}

export async function getCustomerById(customerId) {
  assertValidId(customerId);
  const customer = await Customer.populateForList(
    Customer.findById(customerId)
  );

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  return customer;
}

export async function listCustomers({ search, limit = 50 } = {}) {
  const filter = {};

  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  return Customer.populateForList(
    Customer.find(filter).sort({ name: 1 }).limit(safeLimit)
  );
}

export async function searchCustomers(query, { limit = 20 } = {}) {
  const term = String(query || "").trim();

  if (term.length < 2) {
    throw new AppError("Search query must be at least 2 characters", 400);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  return Customer.populateForList(
    Customer.find({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
      ],
    })
      .sort({ name: 1 })
      .limit(safeLimit)
  );
}

export async function createCustomer(payload = {}) {
  if (!payload.name?.trim()) {
    throw new AppError("name is required", 400);
  }

  const preferredStylistId = await resolvePreferredStylist(
    payload.preferred_stylist_id
  );

  const customer = await Customer.create({
    name: payload.name.trim(),
    phone: normalizePhone(payload.phone),
    dob: parseOptionalDate(payload.dob, "dob") ?? null,
    anniversary_date:
      parseOptionalDate(payload.anniversary_date, "anniversary_date") ?? null,
    gender: parseGender(payload.gender) ?? null,
    tags: normalizeTags(payload.tags) ?? [],
    preferred_stylist_id: preferredStylistId ?? null,
    notes: payload.notes?.trim() || null,
  });

  return getCustomerById(customer._id);
}

export async function updateCustomer(customerId, updates = {}) {
  const customer = await getCustomerById(customerId);

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("name cannot be empty", 400);
    }
    customer.name = String(updates.name).trim();
  }

  if (updates.phone !== undefined) {
    customer.phone = normalizePhone(updates.phone);
  }

  if (updates.dob !== undefined) {
    customer.dob = parseOptionalDate(updates.dob, "dob");
  }

  if (updates.anniversary_date !== undefined) {
    customer.anniversary_date = parseOptionalDate(
      updates.anniversary_date,
      "anniversary_date"
    );
  }

  if (updates.gender !== undefined) {
    customer.gender = parseGender(updates.gender);
  }

  if (updates.tags !== undefined) {
    customer.tags = normalizeTags(updates.tags);
  }

  if (updates.preferred_stylist_id !== undefined) {
    customer.preferred_stylist_id = await resolvePreferredStylist(
      updates.preferred_stylist_id
    );
  }

  if (updates.notes !== undefined) {
    customer.notes = updates.notes ? String(updates.notes).trim() : null;
  }

  await customer.save();
  return getCustomerById(customer._id);
}

export async function findOrCreateCustomer(payload = {}) {
  const phone = normalizePhone(payload.phone);

  let customer = await Customer.findOne({ phone });

  if (customer) {
    return {
      customer: await getCustomerById(customer._id),
      created: false,
    };
  }

  if (!payload.name?.trim()) {
    throw new AppError("name is required to create a new customer", 400);
  }

  const created = await createCustomer(payload);

  return {
    customer: created,
    created: true,
  };
}

export async function getActivePackagesByCustomerId(customerId) {
  assertValidId(customerId, "customer id");

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const now = new Date();
  const docs = await CustomerPackage.find({
    customer_id: customerId,
    status: "active",
  })
    .sort({ expiry_date: 1 })
    .populate("package_master_id", "name type validity_days price included_services credit_count");

  const validActive = [];
  for (const doc of docs) {
    if (doc.expiry_date < now) {
      doc.status = "expired";
      await doc.save();
    } else if (doc.credits_remaining <= 0) {
      doc.status = "exhausted";
      await doc.save();
    } else {
      validActive.push(doc);
    }
  }

  return validActive;
}
