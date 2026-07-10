import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

function buildTokenPayload(user) {
  return {
    sub: user._id.toString(),
    roleId: user.role_id?._id?.toString() || user.role_id?.toString(),
    roleName: user.role_id?.name || null,
  };
}

function issueTokens(user) {
  const payload = buildTokenPayload(user);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ sub: payload.sub }),
  };
}

export async function login(req, res) {
  try {
    const { phone, email, password } = req.body;

    if ((!phone && !email) || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Phone or email and password are required",
      });
    }

    const query = phone ? { phone: phone.trim() } : { email: email.trim().toLowerCase() };

    const user = await User.findOne(query)
      .select("+password_hash")
      .populate("role_id", "name description");

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid credentials",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid credentials",
      });
    }

    const tokens = issueTokens(user);

    return res.json({
      success: true,
      data: {
        user: {
          ...user.toSafeObject(),
          role: user.role_id,
        },
        ...tokens,
      },
      message: "Login successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message,
    });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "refreshToken is required",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub).populate("role_id", "name description");

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid refresh token",
      });
    }

    const tokens = issueTokens(user);

    return res.json({
      success: true,
      data: tokens,
      message: "Token refreshed",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      message: error.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token",
    });
  }
}

export async function me(req, res) {
  try {
    const user = req.user;

    return res.json({
      success: true,
      data: {
        user: {
          ...user.toSafeObject(),
          role: user.role_id,
        },
        // Full permission resolution comes in RBAC sheet (02)
        permissions: [],
      },
      message: "Authenticated user",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message,
    });
  }
}
