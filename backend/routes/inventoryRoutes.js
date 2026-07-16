import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listInventoryHandler,
  getInventoryProductHandler,
  deductStockHandler,
  topUpStockHandler,
  getProductAuditLogHandler,
  getAllAuditLogsHandler,
  getAdjustmentReasonsHandler,
  getStockReportHandler,
} from "../controllers/inventoryController.js";

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

/**
 * GET /api/inventory/meta/reasons
 * Returns list of valid stock adjustment reason codes for front-end dropdowns.
 * Must be declared before /:id routes to prevent "reasons" being treated as an ID.
 *
 * Access: any authenticated user
 */
router.get("/meta/reasons", asyncHandler(getAdjustmentReasonsHandler));

/**
 * GET /api/inventory
 * List all products with stock levels and low-stock flags.
 *
 * Query params:
 *   is_active?   — true | false (default: all)
 *   low_stock?   — true         (only return products at or below reorder_level)
 *   search?      — text search on name / SKU
 *
 * Access: inventory.view
 */
router.get(
  "/",
  requirePermission("inventory", "view"),
  asyncHandler(listInventoryHandler)
);

/**
 * GET /api/inventory/stock-report
 * Generate comprehensive stock report (summary valuation, reorder alerts, product breakdown).
 * Must be declared BEFORE /:id route!
 *
 * Access: inventory.view
 */
router.get(
  "/stock-report",
  requirePermission("inventory", "view"),
  asyncHandler(getStockReportHandler)
);

/**
 * GET /api/inventory/audit-logs
 * Get all stock movement audit logs across all products.
 * Must be declared BEFORE /:id route!
 *
 * Access: inventory.view
 */
router.get(
  "/audit-logs",
  requirePermission("inventory", "view"),
  asyncHandler(getAllAuditLogsHandler)
);

/**
 * GET /api/inventory/:id
 * Get a single product's full stock details.
 *
 * Access: inventory.view
 */
router.get(
  "/:id",
  requirePermission("inventory", "view"),
  asyncHandler(getInventoryProductHandler)
);

/**
 * POST /api/inventory/:id/deduct
 * Manually deduct stock from a product (e.g., damage, shrinkage, audit correction).
 * This is the MANUAL adjustment endpoint — POS deductions happen atomically inside billingService.
 *
 * Body:
 *   quantity        — integer ≥ 1 (required)
 *   reason          — "manual_deduct" | "damage" | "shrinkage" | "audit_correction" |
 *                     "return_to_vendor"  (required)
 *   notes?          — free text explanation
 *   force_override? — boolean (default false)
 *                     When true AND current_stock < quantity:
 *                       • Requires inventory.approve permission on the requesting user.
 *                       • Stock is floored at 0 (never goes negative).
 *                       • AuditLog entry is written with override_used = true.
 *                     When false AND current_stock < quantity:
 *                       • Returns 400 with can_override: true hint.
 *
 * Access: inventory.edit (base) + inventory.approve (only when force_override = true)
 */
router.post(
  "/:id/deduct",
  requirePermission("inventory", "edit"),
  asyncHandler(deductStockHandler)
);

/**
 * POST /api/inventory/:id/top-up
 * Add stock to a product (stock received from supplier, physical recount, etc.).
 *
 * Body:
 *   quantity   — integer ≥ 1 (required)
 *   reason     — "stock_in" | "recount" | "audit_correction" (required)
 *   notes?     — free text
 *
 * Access: inventory.edit
 */
router.post(
  "/:id/top-up",
  requirePermission("inventory", "edit"),
  asyncHandler(topUpStockHandler)
);

/**
 * GET /api/inventory/:id/audit-log
 * View the full stock movement audit trail for a specific product.
 * Shows all deductions, top-ups, override events, and POS-triggered deductions
 * (those are logged inside billingService as well).
 *
 * Query:
 *   page?    — default 1
 *   limit?   — default 20, max 100
 *
 * Access: inventory.view
 */
router.get(
  "/:id/audit-log",
  requirePermission("inventory", "view"),
  asyncHandler(getProductAuditLogHandler)
);

export default router;
