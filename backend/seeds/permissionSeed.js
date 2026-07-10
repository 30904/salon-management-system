import Permission, {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
} from "../models/Permission.js";

export { PERMISSION_ACTIONS, PERMISSION_MODULES };

export function permissionKey(module, action) {
  return `${module}:${action}`;
}

/**
 * All module × action combinations for RBAC (Sheet 02 row 4).
 */
export function getAllPermissionCombos() {
  const combos = [];

  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      combos.push({ module, action });
    }
  }

  return combos;
}

/**
 * Seeds one Permission row per module+action combo.
 */
export async function seedPermissions() {
  const permissions = [];
  const byKey = {};

  for (const { module, action } of getAllPermissionCombos()) {
    const permission = await Permission.findOneAndUpdate(
      { module, action },
      { module, action },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    permissions.push(permission);
    byKey[permissionKey(module, action)] = permission;
  }

  return {
    permissions,
    byKey,
    count: permissions.length,
  };
}

export default seedPermissions;
