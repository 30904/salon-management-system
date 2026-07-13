import Role from "../models/Role.js";
import { AppError } from "../utils/AppError.js";

export async function requireOwnerOrManager(req, res, next) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    let roleName = req.user.role_id?.name;
    if (!roleName && req.user.role_id) {
      const role = await Role.findById(req.user.role_id);
      roleName = role?.name;
    }

    const allowedRoles = ["owner/ceo", "owner", "manager", "salon manager"];
    if (!roleName || !allowedRoles.includes(String(roleName).trim().toLowerCase())) {
      throw new AppError("Access denied. Owner/Manager role required.", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}
