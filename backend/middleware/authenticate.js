import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Authentication required",
      });
    }

    const token = header.slice(7);
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub).populate("role_id", "name description");

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid or inactive user",
      });
    }

    req.user = user;
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      message: error.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
    });
  }
}
