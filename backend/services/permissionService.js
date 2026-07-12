import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import User from "../models/User.js";
import {
  applyUserMenuOverrides,
  listUserMenuOverrides,
} from "./userMenuOverrideService.js";

function mapRolePermissionRows(rolePermissions) {
  const permissions = [];

  for (const row of rolePermissions) {
    const perm = row.permission_id;
    if (!perm) continue;
    permissions.push({
      id: perm._id.toString(),
      module: perm.module,
      action: perm.action,
    });
  }

  return permissions;
}

export async function getRolePermissions(roleId) {
  if (!roleId) {
    return [];
  }

  const rolePermissions = await RolePermission.find({ role_id: roleId })
    .populate("permission_id")
    .lean();

  return mapRolePermissionRows(rolePermissions);
}

export async function resolveUserPermissions(userId) {
  const user = await User.findById(userId).select("role_id");

  if (!user) {
    return [];
  }

  const permissionMap = new Map();

  for (const permission of await getRolePermissions(user.role_id)) {
    permissionMap.set(permission.id, permission);
  }

  const overrides = await listUserMenuOverrides(userId);
  applyUserMenuOverrides(permissionMap, overrides);

  return Array.from(permissionMap.values());
}

export function hasPermission(permissions, module, action = "view") {
  const normalizedModule = String(module).trim().toLowerCase();
  const normalizedAction = String(action).trim().toLowerCase();

  return permissions.some(
    (p) => p.module === normalizedModule && p.action === normalizedAction
  );
}

/** Modules where the user has at least view — drives left-nav rendering. */
export function getViewableModules(permissions) {
  const modules = new Set();

  for (const permission of permissions) {
    if (permission.action === "view") {
      modules.add(permission.module);
    }
  }

  return Array.from(modules).sort();
}

export function buildSessionPermissions(permissions) {
  return {
    permissions,
    modules: getViewableModules(permissions),
  };
}

export async function getSessionPermissions(userId) {
  const permissions = await resolveUserPermissions(userId);
  return buildSessionPermissions(permissions);
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
