import RolePermission from "../models/RolePermission.js";
import { permissionKey, seedPermissions } from "./permissionSeed.js";
import { ROLE_NAMES, seedRoles } from "./roleSeed.js";

const STAFF_PERMISSIONS = [
  { module: "dashboard", actions: ["view"] },
  { module: "bookings", actions: ["view"] },
  { module: "attendance", actions: ["view", "create"] },
  { module: "payroll", actions: ["view"] },
];

const MANAGER_OPERATIONAL_MODULES = [
  "dashboard",
  "bookings",
  "billing",
  "crm",
  "inventory",
  "attendance",
  "employees",
  "reports",
];

const MANAGER_CRUD_ACTIONS = ["view", "create", "edit", "delete"];
const MANAGER_APPROVE_MODULES = ["billing", "inventory"];

function buildStaffAllowedSet() {
  const allowed = new Set();

  for (const { module, actions } of STAFF_PERMISSIONS) {
    for (const action of actions) {
      allowed.add(permissionKey(module, action));
    }
  }

  return allowed;
}

function buildManagerAllowedSet() {
  const allowed = new Set();

  for (const module of MANAGER_OPERATIONAL_MODULES) {
    for (const action of MANAGER_CRUD_ACTIONS) {
      allowed.add(permissionKey(module, action));
    }
  }

  for (const module of MANAGER_APPROVE_MODULES) {
    allowed.add(permissionKey(module, "approve"));
  }

  allowed.add(permissionKey("payroll", "view"));
  allowed.add(permissionKey("settings", "view"));

  return allowed;
}

function filterPermissions(permissionDocs, allowedKeys) {
  return permissionDocs.filter((perm) =>
    allowedKeys.has(permissionKey(perm.module, perm.action))
  );
}

/**
 * Syncs RolePermission rows for one role (adds granted, removes stale).
 */
export async function syncRolePermissions(roleId, grantedPermissions) {
  const grantedIds = grantedPermissions.map((perm) => perm._id);

  await RolePermission.deleteMany({
    role_id: roleId,
    permission_id: { $nin: grantedIds },
  });

  const rows = [];

  for (const permission of grantedPermissions) {
    const row = await RolePermission.findOneAndUpdate(
      { role_id: roleId, permission_id: permission._id },
      { role_id: roleId, permission_id: permission._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    rows.push(row);
  }

  return rows;
}

/**
 * Seeds default RolePermission mappings for all four roles (Sheet 02 row 5).
 * Requires Role and Permission tables to be populated first.
 */
export async function seedRolePermissions(options = {}) {
  const roleResult = options.roles
    ? { roles: options.roles }
    : await seedRoles();
  const permissionResult = options.permissions
    ? { permissions: options.permissions }
    : await seedPermissions();

  const roleDocs = roleResult.roles;
  const permissionDocs = permissionResult.permissions;

  const ownerPermissions = permissionDocs;
  const ownerRows = await syncRolePermissions(
    roleDocs[ROLE_NAMES.OWNER]._id,
    ownerPermissions
  );

  const managerPermissions = filterPermissions(
    permissionDocs,
    buildManagerAllowedSet()
  );
  const managerRows = await syncRolePermissions(
    roleDocs[ROLE_NAMES.MANAGER]._id,
    managerPermissions
  );

  const staffPermissions = filterPermissions(
    permissionDocs,
    buildStaffAllowedSet()
  );
  const stylistRows = await syncRolePermissions(
    roleDocs[ROLE_NAMES.STYLIST]._id,
    staffPermissions
  );
  const massageRows = await syncRolePermissions(
    roleDocs[ROLE_NAMES.MASSAGE_THERAPIST]._id,
    staffPermissions
  );

  const totalRows =
    ownerRows.length +
    managerRows.length +
    stylistRows.length +
    massageRows.length;

  return {
    roles: roleDocs,
    permissions: permissionDocs,
    mappings: {
      [ROLE_NAMES.OWNER]: ownerRows,
      [ROLE_NAMES.MANAGER]: managerRows,
      [ROLE_NAMES.STYLIST]: stylistRows,
      [ROLE_NAMES.MASSAGE_THERAPIST]: massageRows,
    },
    counts: {
      total: totalRows,
      owner: ownerRows.length,
      manager: managerRows.length,
      stylist: stylistRows.length,
      massageTherapist: massageRows.length,
    },
  };
}

export default seedRolePermissions;
