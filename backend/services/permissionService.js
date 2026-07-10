import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import UserMenuOverride from "../models/UserMenuOverride.js";
import User from "../models/User.js";

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

  const overrides = await UserMenuOverride.find({ user_id: userId })
    .populate("permission_id")
    .lean();

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

  return Array.from(permissionMap.values());
}

export function hasPermission(permissions, module, action = "view") {
  return permissions.some((p) => p.module === module && p.action === action);
}

export async function getPermissionByModuleAction(module, action) {
  return Permission.findOne({ module, action });
}
