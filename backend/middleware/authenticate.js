import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice(7);
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub)
      .populate("role_id", "name description")
      .populate("branch_id", "code name address phone is_active");

    if (!user || !user.is_active) {
      throw new AppError("Invalid or inactive user", 401);
    }

    req.user = user;
    req.auth = decoded;
    next();
  } catch (error) {
    next(error);
  }
}
