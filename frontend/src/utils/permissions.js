export function normalizeModule(module) {
  return String(module).trim().toLowerCase();
}

export function normalizeAction(action) {
  return String(action).trim().toLowerCase();
}

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
