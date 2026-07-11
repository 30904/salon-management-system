import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { findActiveUserById } from "../services/userService.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice(7);
    const decoded = verifyAccessToken(token);

    const user = await findActiveUserById(decoded.sub);

    if (!user) {
      throw new AppError("Invalid or inactive user", 401);
    }

    req.user = user;
    req.auth = decoded;
    next();
  } catch (error) {
    next(error);
  }
}
