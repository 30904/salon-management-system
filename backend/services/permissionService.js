import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import User from "../models/User.js";
import {
  getCachedPermissions,
  getCachedRolePermissions,
  invalidatePermissionCache,
  setCachedPermissions,
  setCachedRolePermissions,
} from "../utils/requestCache.js";
import {
  applyUserMenuOverrides,
  listUserMenuOverrides,
} from "./userMenuOverrideService.js";

function resolveRoleId(roleId) {
  if (!roleId) {
    return null;
  }

  return roleId._id?.toString() || roleId.toString();
}

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
  const normalizedRoleId = resolveRoleId(roleId);

  if (!normalizedRoleId) {
    return [];
  }

  const cached = getCachedRolePermissions(normalizedRoleId);
  if (cached) {
    return cached;
  }

  const rolePermissions = await RolePermission.find({ role_id: normalizedRoleId })
    .populate("permission_id")
    .lean();

  const permissions = mapRolePermissionRows(rolePermissions);
  setCachedRolePermissions(normalizedRoleId, permissions);
  return permissions;
}

export async function resolveUserPermissions(userId, roleId = null) {
  const cacheKey = String(userId);
  const cached = getCachedPermissions(cacheKey);
  if (cached) {
    return cached;
  }

  let resolvedRoleId = resolveRoleId(roleId);

  if (!resolvedRoleId) {
    const user = await User.findById(userId).select("role_id").lean();

    if (!user) {
      return [];
    }

    resolvedRoleId = resolveRoleId(user.role_id);
  }

  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(resolvedRoleId),
    listUserMenuOverrides(userId),
  ]);

  const permissionMap = new Map();

  for (const permission of rolePermissions) {
    permissionMap.set(permission.id, permission);
  }

  applyUserMenuOverrides(permissionMap, overrides);

  const permissions = Array.from(permissionMap.values());
  setCachedPermissions(cacheKey, permissions);
  return permissions;
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

export { invalidatePermissionCache };

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
