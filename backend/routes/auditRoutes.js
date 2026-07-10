import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { listAuditLogs } from "../services/auditLogService.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// Owner/CEO audit viewer — full RBAC gate comes in sheet 02
router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const roleName = req.user?.role_id?.name;

    if (roleName !== "Owner/CEO") {
      throw new AppError("Forbidden", 403);
    }

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
