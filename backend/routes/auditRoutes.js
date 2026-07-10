import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { listAuditLogs } from "../services/auditLogService.js";

const router = Router();

router.get(
  "/",
  authenticate,
  requirePermission("audit_logs", "view"),
  asyncHandler(async (req, res) => {
    const { action, entity, entityId, userId, limit } = req.query;

    const logs = await listAuditLogs({
      action,
      entity,
      entityId,
      userId,
      limit: limit ? Number(limit) : 50,
    });

    return sendSuccess(res, {
      data: logs.map((log) => log.toSafeObject()),
      message: "Audit logs fetched",
    });
  })
);

export default router;
