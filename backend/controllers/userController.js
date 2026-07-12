import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  AUDIT_ACTIONS,
  writeAuditLog,
} from "../services/auditLogService.js";
import {
  activateUser,
  createUser,
  deactivateUser,
  getUserById,
  listUsers,
  resetUserPassword,
  updateUser,
} from "../services/userManagementService.js";
import {
  formatUserMenuOverride,
  listUserMenuOverrides,
  syncUserMenuOverrides,
} from "../services/userMenuOverrideService.js";
import {
  getRolePermissions,
  getSessionPermissions,
} from "../services/permissionService.js";
import { sendUserInvite } from "../services/userInviteService.js";

function formatUser(user) {
  return user.toSafeObject();
}

function normalizeId(ref) {
  if (!ref) return null;
  return (ref._id || ref).toString();
}

function getBranchScope(req) {
  return normalizeId(req.user?.branch_id);
}

function assertSameBranch(user, branchId) {
  if (!branchId) return;
  const userBranchId = normalizeId(user.branch_id);

  if (userBranchId !== branchId) {
    throw new AppError("User not found", 404);
  }
}

export async function listUsersHandler(req, res) {
  const branchId = req.query.branch_id || getBranchScope(req);
  const isActive =
    req.query.is_active === undefined
      ? undefined
      : req.query.is_active === "true";

  const users = await listUsers({
    branchId,
    isActive,
    roleId: req.query.role_id,
  });

  return sendSuccess(res, {
    data: users.map(formatUser),
    message: "Users fetched",
  });
}

export async function getUserHandler(req, res) {
  const user = await getUserById(req.params.id);
  assertSameBranch(user, getBranchScope(req));

  return sendSuccess(res, {
    data: formatUser(user),
    message: "User fetched",
  });
}

export async function createUserHandler(req, res) {
  const { name, phone, email, role_id, password, send_invite = true } = req.body;

  const { user, tempPassword } = await createUser({
    name,
    phone,
    email,
    role_id,
    branch_id: getBranchScope(req),
    created_by: req.user._id,
    password,
  });

  let invite = null;

  if (send_invite !== false) {
    invite = await sendUserInvite({
      user,
      tempPassword,
      createdBy: req.user,
    });
  }

  await writeAuditLog({
    req,
    action: AUDIT_ACTIONS.USER_CREATE,
    entity: "User",
    entityId: user._id,
    details: {
      name: user.name,
      phone: user.phone,
      role_id: user.role_id?._id || user.role_id,
      role_name: user.role_id?.name,
      invite_status: invite?.status || "skipped",
    },
  });

  return sendSuccess(res, {
    data: {
      user: formatUser(user),
      tempPassword,
      invite,
    },
    message: "User created",
    status: 201,
  });
}

export async function updateUserHandler(req, res) {
  const existing = await getUserById(req.params.id);
  assertSameBranch(existing, getBranchScope(req));

  const user = await updateUser(req.params.id, req.body, {
    actorId: req.user._id,
  });

  if (req.body.is_active === false) {
    await writeAuditLog({
      req,
      action: AUDIT_ACTIONS.USER_DEACTIVATE,
      entity: "User",
      entityId: user._id,
      details: { name: user.name, phone: user.phone },
    });
  }

  return sendSuccess(res, {
    data: formatUser(user),
    message: "User updated",
  });
}

export async function deactivateUserHandler(req, res) {
  const existing = await getUserById(req.params.id);
  assertSameBranch(existing, getBranchScope(req));

  const user = await deactivateUser(req.params.id, { actorId: req.user._id });

  await writeAuditLog({
    req,
    action: AUDIT_ACTIONS.USER_DEACTIVATE,
    entity: "User",
    entityId: user._id,
    details: { name: user.name, phone: user.phone },
  });

  return sendSuccess(res, {
    data: formatUser(user),
    message: "User deactivated",
  });
}

export async function activateUserHandler(req, res) {
  const existing = await getUserById(req.params.id);
  assertSameBranch(existing, getBranchScope(req));

  const user = await activateUser(req.params.id);

  return sendSuccess(res, {
    data: formatUser(user),
    message: "User activated",
  });
}

export async function getUserPermissionOverridesHandler(req, res) {
  const user = await getUserById(req.params.id);
  assertSameBranch(user, getBranchScope(req));

  const overrides = await listUserMenuOverrides(req.params.id);
  const session = await getSessionPermissions(req.params.id);
  const rolePermissions = await getRolePermissions(user.role_id);

  return sendSuccess(res, {
    data: {
      user_id: user._id,
      overrides: overrides.map(formatUserMenuOverride),
      role_permissions: rolePermissions,
      resolved_permissions: session.permissions,
      modules: session.modules,
    },
    message: "User permission overrides fetched",
  });
}

export async function updateUserPermissionOverridesHandler(req, res) {
  const user = await getUserById(req.params.id);
  assertSameBranch(user, getBranchScope(req));

  const overrides = req.body.overrides;

  if (!Array.isArray(overrides)) {
    throw new AppError("overrides must be an array", 400);
  }

  const updated = await syncUserMenuOverrides(req.params.id, overrides);
  const session = await getSessionPermissions(req.params.id);
  const rolePermissions = await getRolePermissions(user.role_id);

  await writeAuditLog({
    req,
    action: AUDIT_ACTIONS.PERMISSION_CHANGE,
    entity: "User",
    entityId: user._id,
    details: {
      target_user: user.name,
      target_phone: user.phone,
      override_count: updated.length,
      overrides: updated.map((row) => ({
        permission_id: row.permission_id?._id || row.permission_id,
        module: row.permission_id?.module,
        action: row.permission_id?.action,
        granted: row.granted,
      })),
    },
  });

  return sendSuccess(res, {
    data: {
      user_id: user._id,
      overrides: updated.map(formatUserMenuOverride),
      role_permissions: rolePermissions,
      resolved_permissions: session.permissions,
      modules: session.modules,
    },
    message: "User permission overrides updated",
  });
}

export async function resendUserInviteHandler(req, res) {
  const user = await getUserById(req.params.id);
  assertSameBranch(user, getBranchScope(req));

  if (!user.is_active) {
    throw new AppError("Cannot send invite to an inactive user", 400);
  }

  const { user: refreshedUser, tempPassword } = await resetUserPassword(
    req.params.id
  );

  const invite = await sendUserInvite({
    user: refreshedUser,
    tempPassword,
    createdBy: req.user,
  });

  await writeAuditLog({
    req,
    action: AUDIT_ACTIONS.USER_CREATE,
    entity: "User",
    entityId: refreshedUser._id,
    details: {
      action: "resend_invite",
      phone: refreshedUser.phone,
      invite_status: invite.status,
    },
  });

  return sendSuccess(res, {
    data: {
      user: formatUser(refreshedUser),
      tempPassword,
      invite,
    },
    message: "User invite resent",
  });
}
