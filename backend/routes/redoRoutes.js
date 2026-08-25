/**
 * Feature 4 — Redo / rework API.
 * Mounted live on preciousRoutes as /api/redo (billing-adjacent — not dead invoiceRoutes).
 *
 * GET  /config
 * POST /
 * GET  /
 * GET  /:id
 * POST /:id/approve | reject | complete
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { getRedoPublicConfig } from "../constants/redoConstants.js";
import {
  createRedoRequest,
  approveRedoRequest,
  rejectRedoRequest,
  completeRedoRequest,
  listRedoRequests,
  getRedoRequestById,
} from "../services/redoService.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

router.use(authenticate);

router.get(
  "/config",
  requirePermission("billing", "view"),
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, {
      data: getRedoPublicConfig(),
    });
  })
);

router.post(
  "/",
  requirePermission("billing", "edit"),
  asyncHandler(async (req, res) => {
    const originalLineItemId =
      req.body?.original_line_item_id || req.body?.originalLineItemId;
    const redoStaffId = req.body?.redo_staff_id ?? req.body?.redoStaffId ?? null;
    const reason = req.body?.reason || "";

    if (!originalLineItemId) {
      throw new AppError("original_line_item_id is required", 400);
    }

    const doc = await createRedoRequest({
      originalLineItemId,
      redoStaffId,
      reason,
      requestedBy: req.user._id,
    });

    return sendSuccess(res, {
      status: 201,
      data: doc.toSafeObject(),
      message: "Redo request created — pending approval",
    });
  })
);

router.get(
  "/",
  requirePermission("billing", "view"),
  asyncHandler(async (req, res) => {
    const items = await listRedoRequests({
      status: req.query.status || null,
      limit: req.query.limit,
      originalInvoiceId: req.query.original_invoice_id || req.query.originalInvoiceId || null,
      redoInvoiceId: req.query.redo_invoice_id || req.query.redoInvoiceId || null,
    });
    return sendSuccess(res, { data: { items } });
  })
);

router.get(
  "/:id",
  requirePermission("billing", "view"),
  asyncHandler(async (req, res) => {
    const doc = await getRedoRequestById(req.params.id);
    return sendSuccess(res, { data: doc.toSafeObject() });
  })
);

router.post(
  "/:id/approve",
  requirePermission("payroll", "edit"),
  asyncHandler(async (req, res) => {
    const doc = await approveRedoRequest(req.params.id, req.user._id);
    return sendSuccess(res, {
      data: doc.toSafeObject(),
      message: "Redo request approved",
    });
  })
);

router.post(
  "/:id/reject",
  requirePermission("payroll", "edit"),
  asyncHandler(async (req, res) => {
    const doc = await rejectRedoRequest(req.params.id, req.user._id);
    return sendSuccess(res, {
      data: doc.toSafeObject(),
      message: "Redo request rejected",
    });
  })
);

router.post(
  "/:id/complete",
  requirePermission("billing", "edit"),
  asyncHandler(async (req, res) => {
    const productsUsed = req.body?.products_used || req.body?.productsUsed || [];

    const { redoRequest, redoInvoice, redoLine } = await completeRedoRequest(
      req.params.id,
      {
        productsUsed,
        userId: req.user._id,
      }
    );

    return sendSuccess(res, {
      data: {
        redo_request: redoRequest.toSafeObject(),
        redo_invoice: redoInvoice.toSafeObject(),
        redo_line: redoLine.toSafeObject(),
      },
      message: "Redo completed",
    });
  })
);

export default router;

