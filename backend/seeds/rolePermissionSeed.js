import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";
import { ROLE_NAMES, seedRoles } from "./roleSeed.js";

const MODULES = [
  "dashboard",
  "bookings",
  "billing",
  "crm",
  "inventory",
  "attendance",
  "payroll",
  "employees",
  "reports",
  "settings",
  "users",
  "audit_logs",
];

const ACTIONS = ["view", "create", "edit", "delete", "approve"];

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

function permissionKey(module, action) {
  return `${module}:${action}`;
}

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

async function syncRolePermissions(roleId, grantedPermissions) {
  const grantedIds = grantedPermissions.map((perm) => perm._id);

  await RolePermission.deleteMany({
    role_id: roleId,
    permission_id: { $nin: grantedIds },
  });

  for (const permission of grantedPermissions) {
    await RolePermission.findOneAndUpdate(
      { role_id: roleId, permission_id: permission._id },
      { role_id: roleId, permission_id: permission._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

export async function seedRolesAndPermissions() {
  const permissionDocs = [];

  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const permission = await Permission.findOneAndUpdate(
        { module, action },
        { module, action },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      permissionDocs.push(permission);
    }
  }

  const { roles: roleDocs } = await seedRoles();

  const ownerPermissions = permissionDocs;
  await syncRolePermissions(roleDocs[ROLE_NAMES.OWNER]._id, ownerPermissions);

  const managerAllowed = buildManagerAllowedSet();
  const managerPermissions = permissionDocs.filter((perm) =>
    managerAllowed.has(permissionKey(perm.module, perm.action))
  );
  await syncRolePermissions(roleDocs[ROLE_NAMES.MANAGER]._id, managerPermissions);

  const staffAllowed = buildStaffAllowedSet();
  const staffPermissions = permissionDocs.filter((perm) =>
    staffAllowed.has(permissionKey(perm.module, perm.action))
  );

  await syncRolePermissions(roleDocs[ROLE_NAMES.STYLIST]._id, staffPermissions);
  await syncRolePermissions(
    roleDocs[ROLE_NAMES.MASSAGE_THERAPIST]._id,
    staffPermissions
  );

  return {
    roles: roleDocs,
    permissions: permissionDocs,
    counts: {
      permissions: permissionDocs.length,
      owner: ownerPermissions.length,
      manager: managerPermissions.length,
      stylist: staffPermissions.length,
      massageTherapist: staffPermissions.length,
    },
  };
}
