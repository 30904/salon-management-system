import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import {
  buildSessionPermissions,
  getSessionPermissions,
  resolveUserPermissions,
} from "../services/permissionService.js";
import {
  findActiveUserById,
  findUserByLogin,
  verifyPassword,
} from "../services/userService.js";

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

function formatAuthUser(user) {
  const safe = user.toSafeObject();
  return {
    ...safe,
    role: safe.role || user.role_id,
    branch: safe.branch || user.branch_id,
  };
}

async function resolvePermissionsForRequest(req) {
  if (req.permissions) {
    return buildSessionPermissions(req.permissions);
  }

  const session = await getSessionPermissions(req.user._id);
  req.permissions = session.permissions;
  return session;
}

export async function login(req, res) {
  const { phone, email, password } = req.body;

  if ((!phone && !email) || !password) {
    throw new AppError("Phone or email and password are required", 400);
  }

  const user = await findUserByLogin({ phone, email, includePassword: true });

  if (!user || !user.is_active) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }

  const tokens = issueTokens(user);
  const sessionPermissions = await getSessionPermissions(user._id);

  return sendSuccess(res, {
    data: {
      user: formatAuthUser(user),
      ...sessionPermissions,
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
    const user = await findActiveUserById(decoded.sub);

    if (!user) {
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
  const sessionPermissions = await resolvePermissionsForRequest(req);

  return sendSuccess(res, {
    data: {
      user: formatAuthUser(req.user),
      ...sessionPermissions,
    },
    message: "Authenticated user",
  });
}

export async function permissions(req, res) {
  const sessionPermissions = await resolvePermissionsForRequest(req);

  return sendSuccess(res, {
    data: sessionPermissions,
    message: "Session permissions",
  });
}
