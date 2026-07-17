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
    (item) => item.module === normalizedModule && item.action === normalizedAction
  );
}

export function canViewModule(permissions, module) {
  return hasPermission(permissions, module, "view");
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

/** Owner/manager = has billing:view. Staff/stylist self-service = no billing:view. */
export function isOwnerRole(permissions) {
  return canViewModule(permissions, "billing");
}
