import AuditLog from "../models/AuditLog.js";

export const AUDIT_ACTIONS = {
  STOCK_OVERRIDE: "stock_override",
  DISCOUNT_OVERRIDE: "discount_override",
  PACKAGE_REDEMPTION: "package_redemption",
  PAYROLL_FINALIZE: "payroll_finalize",
  PERMISSION_CHANGE: "permission_change",
  USER_CREATE: "user_create",
  USER_DEACTIVATE: "user_deactivate",
};

/**
 * Write an audit log entry for sensitive actions.
 * Failures are logged but do not throw — main business flow must not break.
 */
export async function writeAuditLog({
  userId = null,
  req = null,
  action,
  entity,
  entityId = null,
  details = {},
}) {
  const resolvedUserId = userId || req?.user?._id || req?.auth?.sub || null;

  try {
    const entry = await AuditLog.create({
      user_id: resolvedUserId,
      action,
      entity,
      entity_id: entityId,
      details_json: details,
    });

    return entry;
  } catch (error) {
    console.error("[audit] Failed to write audit log:", error.message);
    return null;
  }
}

export async function listAuditLogs({
  action,
  entity,
  entityId,
  userId,
  limit = 50,
}) {
  const filter = {};

  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (entityId) filter.entity_id = entityId;
  if (userId) filter.user_id = userId;

  return AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user_id", "name phone");
}
