/**
 * Central permission helper — full RBAC wiring comes in sheet 02.
 * When permissions array is empty (dev), all menu items are shown.
 */
export function hasPermission(permissions, module, action = "view") {
  if (!permissions || permissions.length === 0) {
    return true;
  }

  return permissions.some(
    (item) => item.module === module && item.action === action
  );
}

export function filterNavItems(navItems, permissions) {
  return navItems.filter((item) => hasPermission(permissions, item.module, "view"));
}
