/**
 * Mobile bottom-tab config. Curated subset of desktop NAV_ITEMS — 5 max per role.
 * `ownerOnly` tabs only render when the session has billing:view (isOwner).
 */
export const NAV_ITEMS = [
  { key: "home", label: "Home", path: "/home", module: "dashboard", icon: "home" },
  { key: "attendance", label: "Attendance", path: "/attendance", module: "attendance", icon: "clock" },
  { key: "earnings", label: "Earnings", path: "/earnings", module: "payroll", icon: "wallet" },
  { key: "bookings", label: "Bookings", path: "/bookings", module: "bookings", icon: "calendar" },
  { key: "profile", label: "Profile", path: "/profile", icon: "user" },
];

export const OWNER_NAV_ITEMS = [
  { key: "home", label: "Home", path: "/home", module: "dashboard", icon: "home" },
  { key: "attendance", label: "Punch", path: "/attendance", module: "attendance", icon: "clock" },
  { key: "team", label: "Team", path: "/team", module: "reports", icon: "team" },
  { key: "bookings", label: "Bookings", path: "/bookings", module: "bookings", icon: "calendar" },
  { key: "profile", label: "Profile", path: "/profile", icon: "user" },
];
