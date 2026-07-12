import { NAV_ITEMS } from "../config/navItems.js";
import { hasPermission } from "./permissions.js";

function sortNavItemsByPathDepth(navItems) {
  return [...navItems].sort((a, b) => b.path.length - a.path.length);
}

export function findNavItemForPath(pathname, navItems = NAV_ITEMS) {
  return sortNavItemsByPathDepth(navItems).find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
}

export function getRequiredAccess(pathname, navItems = NAV_ITEMS) {
  const match = findNavItemForPath(pathname, navItems);

  if (!match) {
    return null;
  }

  if (pathname.endsWith("/new")) {
    return { module: match.module, action: "create" };
  }

  if (pathname.includes("/edit") || pathname.includes("/permissions")) {
    return { module: match.module, action: "edit" };
  }

  return { module: match.module, action: "view" };
}

export function canAccessPath(pathname, permissions, navItems = NAV_ITEMS) {
  if (!pathname || pathname === "/login") {
    return false;
  }

  const required = getRequiredAccess(pathname, navItems);

  if (!required) {
    return false;
  }

  return hasPermission(permissions, required.module, required.action);
}

export function getFirstAllowedPath(modules, navItems = NAV_ITEMS) {
  const item = navItems.find((nav) => modules.includes(nav.module));
  return item?.path || null;
}

export function resolvePostLoginPath({
  modules = [],
  permissions = [],
  fromPathname,
  navItems = NAV_ITEMS,
} = {}) {
  if (
    fromPathname &&
    fromPathname !== "/login" &&
    canAccessPath(fromPathname, permissions, navItems)
  ) {
    return fromPathname;
  }

  return getFirstAllowedPath(modules, navItems);
}

export function parseLoginIdentifier(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return { phone: undefined, email: undefined };
  }

  if (trimmed.includes("@")) {
    return { email: trimmed.toLowerCase(), phone: undefined };
  }

  return { phone: trimmed, email: undefined };
}
