import mongoose from "mongoose";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { generateTempPassword } from "../utils/generateTempPassword.js";
import { hashPassword } from "./userService.js";

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function formatDuplicateMessage(error) {
  const keys = Object.keys(error.keyPattern || {});

  if (keys.includes("email")) {
    return "A user with this email already exists";
  }

  if (keys.includes("phone") || keys.some((key) => key.includes("phone"))) {
    return "A user with this phone already exists for this branch";
  }

  return "Duplicate user record";
}

export async function getUserById(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user id", 400);
  }

  const user = await User.populateForList(User.findById(userId));

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}

export async function listUsers({ branchId, isActive, roleId } = {}) {
  const filter = {};

  if (branchId) {
    filter.branch_id = branchId;
  }

  if (isActive !== undefined) {
    filter.is_active = isActive;
  }

  if (roleId) {
    filter.role_id = roleId;
  }

  return User.populateForList(User.find(filter).sort({ createdAt: -1 }));
}

export async function createUser({
  name,
  phone,
  email = null,
  role_id,
  branch_id,
  created_by,
  password,
}) {
  if (!name?.trim()) {
    throw new AppError("Name is required", 400);
  }

  if (!phone?.trim()) {
    throw new AppError("Phone is required", 400);
  }

  if (!role_id) {
    throw new AppError("role_id is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(role_id)) {
    throw new AppError("Invalid role_id", 400);
  }

  const role = await Role.findById(role_id);

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  const tempPassword = password || generateTempPassword();
  const password_hash = await hashPassword(tempPassword);

  try {
    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim().toLowerCase() || null,
      password_hash,
      role_id,
      branch_id: branch_id || null,
      is_active: true,
      created_by: created_by || null,
    });

    await user.populate([
      { path: "role_id", select: "name description" },
      { path: "branch_id", select: "code name address phone is_active" },
      { path: "created_by", select: "name phone" },
    ]);

    return { user, tempPassword };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(formatDuplicateMessage(error), 409);
    }
    throw error;
  }
}

export async function updateUser(userId, updates, { actorId } = {}) {
  const user = await getUserById(userId);

  if (updates.role_id) {
    if (!mongoose.Types.ObjectId.isValid(updates.role_id)) {
      throw new AppError("Invalid role_id", 400);
    }

    const role = await Role.findById(updates.role_id);

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    user.role_id = updates.role_id;
  }

  if (updates.name !== undefined) {
    if (!String(updates.name).trim()) {
      throw new AppError("Name cannot be empty", 400);
    }
    user.name = String(updates.name).trim();
  }

  if (updates.phone !== undefined) {
    if (!String(updates.phone).trim()) {
      throw new AppError("Phone cannot be empty", 400);
    }
    user.phone = String(updates.phone).trim();
  }

  if (updates.email !== undefined) {
    user.email = updates.email ? String(updates.email).trim().toLowerCase() : null;
  }

  if (updates.is_active !== undefined) {
    if (actorId && user._id.toString() === actorId.toString() && updates.is_active === false) {
      throw new AppError("You cannot deactivate your own account", 400);
    }
    user.is_active = Boolean(updates.is_active);
  }

  try {
    await user.save();
    return User.populateForList(User.findById(user._id));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(formatDuplicateMessage(error), 409);
    }
    throw error;
  }
}

export async function deactivateUser(userId, { actorId } = {}) {
  if (actorId && userId.toString() === actorId.toString()) {
    throw new AppError("You cannot deactivate your own account", 400);
  }

  const user = await updateUser(userId, { is_active: false }, { actorId });
  return user;
}

export async function activateUser(userId) {
  const user = await updateUser(userId, { is_active: true });
  return user;
}

export async function resetUserPassword(userId, { password } = {}) {
  const user = await User.findById(userId).select("+password_hash");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const tempPassword = password || generateTempPassword();
  user.password_hash = await hashPassword(tempPassword);
  await user.save();

  const refreshed = await User.populateForList(User.findById(user._id));
  return { user: refreshed, tempPassword };
}
