export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
];

export const PERMISSION_MODULES = [
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

export function permissionKey(module, action) {
  return `${module}:${action}`;
}

export function formatModuleLabel(module) {
  return module.replace(/_/g, " ");
}
