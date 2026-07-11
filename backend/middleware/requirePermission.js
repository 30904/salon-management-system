import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
} from "../models/Permission.js";
import { AppError } from "../utils/AppError.js";
import {
  hasPermission,
  resolveUserPermissions,
} from "../services/permissionService.js";

function normalizeModule(module) {
  return String(module).trim().toLowerCase();
}

function normalizeAction(action) {
  return String(action).trim().toLowerCase();
}

function assertValidPermission(module, action) {
  if (!PERMISSION_MODULES.includes(module)) {
    throw new Error(
      `Invalid permission module "${module}". Must be one of: ${PERMISSION_MODULES.join(", ")}`
    );
  }

  if (!PERMISSION_ACTIONS.includes(action)) {
    throw new Error(
      `Invalid permission action "${action}". Must be one of: ${PERMISSION_ACTIONS.join(", ")}`
    );
  }
}

/**
 * Resolves RolePermission + UserMenuOverride once per request.
 * Use after authenticate — optional if requirePermission runs on the same chain.
 */
export async function loadPermissions(req, res, next) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    if (!req.permissions) {
      req.permissions = await resolveUserPermissions(req.user._id);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Gate route by module + action. Returns 403 if the user lacks permission.
 * Resolves RolePermission defaults plus UserMenuOverride rows.
 */
export function requirePermission(module, action = "view") {
  const normalizedModule = normalizeModule(module);
  const normalizedAction = normalizeAction(action);

  assertValidPermission(normalizedModule, normalizedAction);

  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const permissions =
        req.permissions || (await resolveUserPermissions(req.user._id));

      req.permissions = permissions;

      if (!hasPermission(permissions, normalizedModule, normalizedAction)) {
        throw new AppError(
          `Forbidden: missing permission ${normalizedModule}.${normalizedAction}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Pass if the user has at least one of the listed permissions.
 * Each entry: { module, action } or [module, action].
 */
export function requireAnyPermission(...requirements) {
  const normalized = requirements.map((entry) => {
    const module = Array.isArray(entry) ? entry[0] : entry.module;
    const action = Array.isArray(entry) ? entry[1] : entry.action || "view";
    const normalizedModule = normalizeModule(module);
    const normalizedAction = normalizeAction(action);

    assertValidPermission(normalizedModule, normalizedAction);

    return { module: normalizedModule, action: normalizedAction };
  });

  if (normalized.length === 0) {
    throw new Error("requireAnyPermission requires at least one permission");
  }

  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const permissions =
        req.permissions || (await resolveUserPermissions(req.user._id));

      req.permissions = permissions;

      const allowed = normalized.some(({ module, action }) =>
        hasPermission(permissions, module, action)
      );

      if (!allowed) {
        const required = normalized
          .map(({ module, action }) => `${module}.${action}`)
          .join(" | ");
        throw new AppError(`Forbidden: missing one of ${required}`, 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** authenticate → loadPermissions — reuse on protected route groups */
export const authWithPermissions = [loadPermissions];
