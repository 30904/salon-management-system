import { AppError } from "../utils/AppError.js";
import { hasPermission, resolveUserPermissions } from "../services/permissionService.js";

export function requirePermission(module, action = "view") {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401);
      }

      const permissions =
        req.permissions || (await resolveUserPermissions(req.user._id));

      req.permissions = permissions;

      if (!hasPermission(permissions, module, action)) {
        throw new AppError("Forbidden", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
