import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import RolePermission from "../models/RolePermission.js";

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

const ROLES = [
  {
    name: "Owner/CEO",
    description: "Full access to every module including user management",
  },
  {
    name: "Manager",
    description:
      "Full operational access — no user management, payroll view only",
  },
  {
    name: "Stylist",
    description: "Own attendance punch, booking calendar view, and earnings",
  },
  {
    name: "Massage/Spa Therapist",
    description:
      "Same access as Stylist — separate role for specialization tracking",
  },
];

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

  const roleDocs = {};

  for (const roleDef of ROLES) {
    roleDocs[roleDef.name] = await Role.findOneAndUpdate(
      { name: roleDef.name },
      { name: roleDef.name, description: roleDef.description },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const ownerPermissions = permissionDocs;
  await syncRolePermissions(roleDocs["Owner/CEO"]._id, ownerPermissions);

  const managerAllowed = buildManagerAllowedSet();
  const managerPermissions = permissionDocs.filter((perm) =>
    managerAllowed.has(permissionKey(perm.module, perm.action))
  );
  await syncRolePermissions(roleDocs.Manager._id, managerPermissions);

  const staffAllowed = buildStaffAllowedSet();
  const staffPermissions = permissionDocs.filter((perm) =>
    staffAllowed.has(permissionKey(perm.module, perm.action))
  );

  await syncRolePermissions(roleDocs.Stylist._id, staffPermissions);
  await syncRolePermissions(
    roleDocs["Massage/Spa Therapist"]._id,
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
