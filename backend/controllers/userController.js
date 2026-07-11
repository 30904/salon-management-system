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
  updateUser,
} from "../services/userManagementService.js";

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
  const { name, phone, email, role_id, password } = req.body;

  const { user, tempPassword } = await createUser({
    name,
    phone,
    email,
    role_id,
    branch_id: getBranchScope(req),
    created_by: req.user._id,
    password,
  });

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
    },
  });

  return sendSuccess(res, {
    data: {
      user: formatUser(user),
      tempPassword,
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
