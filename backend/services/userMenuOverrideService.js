import UserMenuOverride from "../models/UserMenuOverride.js";
import Permission from "../models/Permission.js";
import { AppError } from "../utils/AppError.js";

/**
 * Applies CEO per-user overrides on top of a role-based permission map.
 * granted=true adds permission; granted=false revokes even if role grants it.
 */
export function applyUserMenuOverrides(permissionMap, overrides) {
  for (const override of overrides) {
    const perm = override.permission_id;
    if (!perm) continue;

    const key = perm._id.toString();

    if (override.granted) {
      permissionMap.set(key, {
        id: key,
        module: perm.module,
        action: perm.action,
      });
    } else {
      permissionMap.delete(key);
    }
  }

  return permissionMap;
}

export async function listUserMenuOverrides(userId) {
  return UserMenuOverride.find({ user_id: userId })
    .populate("permission_id")
    .sort({ createdAt: 1 });
}

export async function getUserMenuOverride(userId, permissionId) {
  return UserMenuOverride.findOne({
    user_id: userId,
    permission_id: permissionId,
  }).populate("permission_id");
}

export async function setUserMenuOverride(userId, permissionId, granted) {
  const override = await UserMenuOverride.findOneAndUpdate(
    { user_id: userId, permission_id: permissionId },
    { user_id: userId, permission_id: permissionId, granted },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate("permission_id");

  return override;
}

export async function setUserMenuOverrideByModuleAction(
  userId,
  module,
  action,
  granted
) {
  const permission = await Permission.findOne({ module, action });

  if (!permission) {
    throw new AppError(`Permission not found: ${module}.${action}`, 404);
  }

  return setUserMenuOverride(userId, permission._id, granted);
}

export async function removeUserMenuOverride(userId, permissionId) {
  return UserMenuOverride.findOneAndDelete({
    user_id: userId,
    permission_id: permissionId,
  });
}

export async function clearUserMenuOverrides(userId) {
  const result = await UserMenuOverride.deleteMany({ user_id: userId });
  return result.deletedCount;
}

export async function syncUserMenuOverrides(userId, overrides = []) {
  const desiredIds = new Set();

  for (const item of overrides) {
    const permissionId = item.permission_id || item.permissionId;
    if (!permissionId) {
      throw new AppError("Each override requires permission_id", 400);
    }

    desiredIds.add(permissionId.toString());
    await setUserMenuOverride(userId, permissionId, Boolean(item.granted));
  }

  const existing = await UserMenuOverride.find({ user_id: userId }).select(
    "permission_id"
  );

  for (const row of existing) {
    if (!desiredIds.has(row.permission_id.toString())) {
      await row.deleteOne();
    }
  }

  return listUserMenuOverrides(userId);
}
