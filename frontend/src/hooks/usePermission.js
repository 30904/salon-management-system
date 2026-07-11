import { useCallback, useMemo } from "react";
import { useShell } from "../context/ShellContext.jsx";

export function normalizeModule(module) {
  return String(module).trim().toLowerCase();
}

export function normalizeAction(action) {
  return String(action).trim().toLowerCase();
}

/**
 * Pure permission check — use this in non-React code or pass permissions explicitly.
 */
export function hasPermission(permissions, module, action = "view") {
  if (!permissions?.length) {
    return false;
  }

  const normalizedModule = normalizeModule(module);
  const normalizedAction = normalizeAction(action);

  return permissions.some(
    (item) =>
      item.module === normalizedModule && item.action === normalizedAction
  );
}

export function hasAnyPermission(permissions, requirements) {
  return requirements.some((entry) => {
    const module = Array.isArray(entry) ? entry[0] : entry.module;
    const action = Array.isArray(entry) ? entry[1] : entry.action || "view";
    return hasPermission(permissions, module, action);
  });
}

export function hasAllPermissions(permissions, requirements) {
  return requirements.every((entry) => {
    const module = Array.isArray(entry) ? entry[0] : entry.module;
    const action = Array.isArray(entry) ? entry[1] : entry.action || "view";
    return hasPermission(permissions, module, action);
  });
}

export function getViewableModules(permissions) {
  if (!permissions?.length) {
    return [];
  }

  const modules = new Set();

  for (const permission of permissions) {
    if (permission.action === "view") {
      modules.add(permission.module);
    }
  }

  return Array.from(modules).sort();
}

export function canViewModule(permissions, module) {
  return hasPermission(permissions, module, "view");
}

export function filterNavItems(navItems, permissions, options = {}) {
  const { permissionsLoaded = true } = options;

  if (!permissionsLoaded) {
    return [];
  }

  return navItems.filter((item) => canViewModule(permissions, item.module));
}

/**
 * Central RBAC helper for components — reads session permissions from ShellContext.
 * Do not scatter if (role === 'owner') checks; call hasPermission(module, action) instead.
 */
export function usePermission() {
  const { permissions, permissionsLoaded, user } = useShell();

  const viewableModules = useMemo(
    () => getViewableModules(permissions),
    [permissions]
  );

  const checkPermission = useCallback(
    (module, action = "view") => hasPermission(permissions, module, action),
    [permissions]
  );

  const checkAnyPermission = useCallback(
    (requirements) => hasAnyPermission(permissions, requirements),
    [permissions]
  );

  const checkAllPermissions = useCallback(
    (requirements) => hasAllPermissions(permissions, requirements),
    [permissions]
  );

  const canView = useCallback(
    (module) => canViewModule(permissions, module),
    [permissions]
  );

  return {
    permissions,
    permissionsLoaded,
    user,
    viewableModules,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    canView,
  };
}

export default usePermission;
