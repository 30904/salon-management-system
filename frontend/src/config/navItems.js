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
    icon: "▣",
    group: "main",
  },
  {
    key: "bookings",
    label: "Bookings",
    path: "/bookings",
    module: "bookings",
    icon: "◷",
    group: "operations",
  },
  {
    key: "billing",
    label: "Billing",
    path: "/billing",
    module: "billing",
    icon: "₹",
    group: "operations",
  },
  {
    key: "crm",
    label: "CRM",
    path: "/crm",
    module: "crm",
    icon: "◉",
    group: "operations",
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/attendance",
    module: "attendance",
    icon: "◔",
    group: "operations",
  },
  {
    key: "inventory",
    label: "Inventory",
    path: "/inventory",
    module: "inventory",
    icon: "▤",
    group: "management",
  },
  {
    key: "payroll",
    label: "Payroll",
    path: "/payroll",
    module: "payroll",
    icon: "◧",
    group: "management",
  },
  {
    key: "employees",
    label: "Employees",
    path: "/employees",
    module: "employees",
    icon: "◎",
    group: "management",
  },
  {
    key: "users",
    label: "Users",
    path: "/users",
    module: "users",
    icon: "◈",
    group: "management",
  },
  {
    key: "reports",
    label: "Reports",
    path: "/reports",
    module: "reports",
    icon: "▥",
    group: "management",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    module: "settings",
    icon: "⚙",
    group: "settings",
  },
];

export const NAV_GROUP_LABELS = {
  main: "Main",
  operations: "Operations",
  management: "Management",
  settings: "Settings",
};
