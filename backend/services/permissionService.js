import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import User from "../models/User.js";
import {
  applyUserMenuOverrides,
  listUserMenuOverrides,
} from "./userMenuOverrideService.js";

export async function resolveUserPermissions(userId) {
  const user = await User.findById(userId).select("role_id");

  if (!user) {
    return [];
  }

  const rolePermissions = await RolePermission.find({ role_id: user.role_id })
    .populate("permission_id")
    .lean();

  const permissionMap = new Map();

  for (const row of rolePermissions) {
    const perm = row.permission_id;
    if (!perm) continue;
    permissionMap.set(perm._id.toString(), {
      id: perm._id.toString(),
      module: perm.module,
      action: perm.action,
    });
  }

  const overrides = await listUserMenuOverrides(userId);
  applyUserMenuOverrides(permissionMap, overrides);

  return Array.from(permissionMap.values());
}

export function hasPermission(permissions, module, action = "view") {
  return permissions.some((p) => p.module === module && p.action === action);
}

export async function getPermissionByModuleAction(module, action) {
  return Permission.findOne({ module, action });
}

// Re-export override helpers for user management APIs (Sheet 02 row 15).
export {
  applyUserMenuOverrides,
  clearUserMenuOverrides,
  getUserMenuOverride,
  listUserMenuOverrides,
  removeUserMenuOverride,
  setUserMenuOverride,
  setUserMenuOverrideByModuleAction,
  syncUserMenuOverrides,
} from "./userMenuOverrideService.js";
