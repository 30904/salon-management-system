import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { resolveUserPermissions } from "../services/permissionService.js";

function buildTokenPayload(user) {
  return {
    sub: user._id.toString(),
    roleId: user.role_id?._id?.toString() || user.role_id?.toString(),
    roleName: user.role_id?.name || null,
    branchId: user.branch_id?._id?.toString() || user.branch_id?.toString() || null,
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
  const { phone, email, password } = req.body;

  if ((!phone && !email) || !password) {
    throw new AppError("Phone or email and password are required", 400);
  }

  const query = phone ? { phone: phone.trim() } : { email: email.trim().toLowerCase() };

  const user = await User.findOne(query)
    .select("+password_hash")
    .populate("role_id", "name description")
    .populate("branch_id", "code name address phone is_active");

  if (!user || !user.is_active) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }

  const tokens = issueTokens(user);

  return sendSuccess(res, {
    data: {
      user: {
        ...user.toSafeObject(),
        role: user.role_id,
        branch: user.branch_id,
      },
      ...tokens,
    },
    message: "Login successful",
  });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("refreshToken is required", 400);
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub)
      .populate("role_id", "name description")
      .populate("branch_id", "code name address phone is_active");

    if (!user || !user.is_active) {
      throw new AppError("Invalid refresh token", 401);
    }

    const tokens = issueTokens(user);

    return sendSuccess(res, {
      data: tokens,
      message: "Token refreshed",
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token",
      401
    );
  }
}

export async function me(req, res) {
  const user = req.user;
  const permissions = await resolveUserPermissions(user._id);

  return sendSuccess(res, {
    data: {
      user: {
        ...user.toSafeObject(),
        role: user.role_id,
        branch: user.branch_id,
      },
      permissions,
    },
    message: "Authenticated user",
  });
}
