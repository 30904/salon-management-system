/**
 * ERP left-nav order (Implementation Guide).
 * `module` maps to RBAC Permission.module for filtering.
 */
export const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    module: "dashboard",
    group: "main",
  },
  {
    key: "bookings",
    label: "Bookings",
    path: "/bookings",
    module: "bookings",
    group: "operations",
  },
  {
    key: "billing",
    label: "Billing",
    path: "/billing",
    module: "billing",
    group: "operations",
  },
  {
    key: "crm",
    label: "CRM",
    path: "/crm",
    module: "crm",
    group: "operations",
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/attendance",
    module: "attendance",
    group: "operations",
  },
  {
    key: "inventory",
    label: "Inventory",
    path: "/inventory",
    module: "inventory",
    group: "management",
  },
  {
    key: "payroll",
    label: "Payroll",
    path: "/payroll",
    module: "payroll",
    group: "management",
  },
  {
    key: "employees",
    label: "Employees",
    path: "/employees",
    module: "employees",
    group: "management",
  },
  {
    key: "users",
    label: "Users",
    path: "/users",
    module: "users",
    group: "management",
  },
  {
    key: "reports",
    label: "Reports",
    path: "/reports",
    module: "reports",
    group: "management",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    module: "settings",
    group: "settings",
  },
];

export const NAV_GROUP_LABELS = {
  main: "Main",
  operations: "Operations",
  management: "Management",
  settings: "Settings",
};
