import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import {
  getCachedUser,
  invalidateUserCache,
  setCachedUser,
} from "../utils/requestCache.js";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function buildLoginQuery({ phone, email }) {
  if (phone) {
    return { phone: phone.trim() };
  }

  if (email) {
    return { email: email.trim().toLowerCase() };
  }

  return null;
}

export async function findUserByLogin({ phone, email, includePassword = false }) {
  const query = buildLoginQuery({ phone, email });

  if (!query) {
    return null;
  }

  let dbQuery = User.findOne(query);

  if (includePassword) {
    dbQuery = dbQuery.select("+password_hash");
  }

  return User.populateForAuth(dbQuery);
}

export async function findActiveUserById(userId) {
  const cacheKey = String(userId);
  const cached = getCachedUser(cacheKey);

  if (cached) {
    return cached;
  }

  const user = await User.populateForAuth(User.findById(userId));

  if (!user || !user.is_active) {
    return null;
  }

  setCachedUser(cacheKey, user);
  return user;
}

export { invalidateUserCache };

export async function deactivateUser(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { is_active: false },
    { new: true }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}

export async function activateUser(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { is_active: true },
    { new: true }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}

export async function listUsers({ branchId, isActive } = {}) {
  const filter = {};

  if (branchId) {
    filter.branch_id = branchId;
  }

  if (isActive !== undefined) {
    filter.is_active = isActive;
  }

  return User.populateForList(User.find(filter).sort({ createdAt: -1 }));
}
