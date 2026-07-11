/**
 * ERP left-nav order (Implementation Guide).
 * `module` maps to RBAC Permission.module for filtering.
 */
export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", module: "dashboard", icon: "◫" },
  { key: "bookings", label: "Bookings", path: "/bookings", module: "bookings", icon: "◷" },
  { key: "billing", label: "Billing", path: "/billing", module: "billing", icon: "₹" },
  { key: "crm", label: "CRM", path: "/crm", module: "crm", icon: "◉" },
  { key: "inventory", label: "Inventory", path: "/inventory", module: "inventory", icon: "▤" },
  { key: "attendance", label: "Attendance", path: "/attendance", module: "attendance", icon: "◔" },
  { key: "payroll", label: "Payroll", path: "/payroll", module: "payroll", icon: "◧" },
  { key: "employees", label: "Employees", path: "/employees", module: "employees", icon: "◎" },
  { key: "users", label: "Users", path: "/users", module: "users", icon: "◈" },
  { key: "reports", label: "Reports", path: "/reports", module: "reports", icon: "▥" },
  { key: "settings", label: "Settings", path: "/settings", module: "settings", icon: "⚙" },
];
