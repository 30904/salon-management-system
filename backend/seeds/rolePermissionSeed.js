import { seedPermissions } from "./permissionSeed.js";
import { seedRoles } from "./roleSeed.js";
import { seedRolePermissions } from "./rolePermissionTableSeed.js";

/**
 * Full RBAC seed: roles + permissions + role-permission mappings.
 */
export async function seedRolesAndPermissions() {
  const { roles } = await seedRoles();
  const { permissions } = await seedPermissions();

  const result = await seedRolePermissions({ roles, permissions });

  return {
    roles: result.roles,
    permissions: result.permissions,
    counts: {
      permissions: result.permissions.length,
      rolePermissions: result.counts.total,
      owner: result.counts.owner,
      manager: result.counts.manager,
      stylist: result.counts.stylist,
      massageTherapist: result.counts.massageTherapist,
    },
  };
}

export default seedRolesAndPermissions;
