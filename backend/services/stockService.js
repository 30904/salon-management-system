import ProductMaster from "../models/ProductMaster.js";
import AuditLog from "../models/AuditLog.js";
import { AppError } from "../utils/AppError.js";
import { hasPermission, resolveUserPermissions } from "./permissionService.js";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ADJUSTMENT_REASONS = [
  "sale",              // Normal POS deduction (done inside billingService, not here)
  "manual_deduct",     // Manual stock write-down by manager
  "damage",            // Damaged / expired goods removed
  "shrinkage",         // Theft / unaccounted loss
  "audit_correction",  // Physical count reconciliation
  "return_to_vendor",  // Returned to supplier
  "stock_in",          // Stock received / top-up
  "recount",           // Override after physical count
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Write an AuditLog entry for a stock movement.
 * Fire-and-forget inside the calling transaction via session if provided.
 */
async function writeStockAuditLog({ userId, action, product, delta, reason, override, notes, session }) {
  const entry = {
    user_id: userId || null,
    action,
    entity: "ProductMaster",
    entity_id: product._id,
    details_json: {
      product_id: product._id,
      product_name: product.name,
      sku: product.sku,
      delta,                           // negative = deduct, positive = top-up
      stock_before: product._stockBefore ?? null,
      stock_after: product.current_stock,
      reason,
      override_used: Boolean(override),
      notes: notes || null,
    },
  };

  if (session) {
    await AuditLog.create([entry], { session });
  } else {
    await AuditLog.create(entry);
  }
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Deduct stock from a ProductMaster atomically.
 *
 * Normal flow (no override):
 *   - Fetches product and checks current_stock ≥ quantity.
 *   - If insufficient: throws 400 AppError.
 *   - Decrements current_stock and writes AuditLog.
 *
 * Manager override flow (override = true):
 *   - Caller must have `inventory.approve` permission (checked here).
 *   - Allows deduction even when current_stock < quantity (stock can go to 0 floor).
 *   - Writes AuditLog entry with override_used = true.
 *
 * @param {string|ObjectId}  productId     - ProductMaster _id
 * @param {number}           quantity      - Units to deduct (≥1)
 * @param {string}           reason        - One of ADJUSTMENT_REASONS
 * @param {object}           options
 * @param {boolean}          [options.override=false]    - Force deduct even if insufficient stock
 * @param {Array}            [options.permissions=[]]    - Resolved permission list for the acting user
 * @param {string|ObjectId}  [options.userId=null]       - For AuditLog
 * @param {string}           [options.notes]             - Optional free text reason
 * @param {mongoose.ClientSession} [options.session]     - Mongoose session for atomic billing transactions
 *
 * @returns {{ product, stock_before, stock_after, deducted, override_used }}
 */
export async function deductStock(productId, quantity, reason, {
  override = false,
  permissions = [],
  userId = null,
  notes = null,
  session = null,
} = {}) {
  if (!ADJUSTMENT_REASONS.includes(reason)) {
    throw new AppError(
      `Invalid stock adjustment reason '${reason}'. Allowed: ${ADJUSTMENT_REASONS.join(", ")}`,
      400
    );
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
    throw new AppError("Quantity must be a positive integer", 400);
  }

  // Fetch the product
  const product = await ProductMaster
    .findOne({ _id: productId, is_active: true })
    .session(session);

  if (!product) {
    throw new AppError(`Product (ID: ${productId}) not found or inactive`, 404);
  }

  const stockBefore = product.current_stock;

  // Stock sufficiency check
  if (stockBefore < qty) {
    if (!override) {
      throw new AppError(
        `Insufficient stock for '${product.name}'. Available: ${stockBefore}, Requested: ${qty}. ` +
        `Use force_override: true with inventory.approve permission to proceed.`,
        400,
        {
          product_id: product._id,
          product_name: product.name,
          sku: product.sku,
          available: stockBefore,
          requested: qty,
          can_override: true,
        }
      );
    }

    // Override path — verify the acting user has inventory.approve
    const canApprove = hasPermission(permissions, "inventory", "approve");
    if (!canApprove) {
      throw new AppError(
        `Cannot override insufficient stock for '${product.name}': requires inventory.approve permission.`,
        403,
        {
          product_id: product._id,
          product_name: product.name,
          available: stockBefore,
          requested: qty,
        }
      );
    }
  }

  // Apply the deduction — floor at 0 when override allows going below
  const newStock = override
    ? Math.max(0, stockBefore - qty)
    : stockBefore - qty;

  product._stockBefore = stockBefore;   // stash for audit log
  product.current_stock = newStock;
  await product.save({ session });

  // Write AuditLog entry
  await writeStockAuditLog({
    userId,
    action: "stock_deduct",
    product,
    delta: -(stockBefore - newStock),   // actual change (negative)
    reason,
    override,
    notes,
    session,
  });

  return {
    product: product.toSafeObject(),
    stock_before: stockBefore,
    stock_after: newStock,
    deducted: stockBefore - newStock,
    override_used: override && stockBefore < qty,
  };
}

/**
 * Add / replenish stock (stock-in / top-up).
 * Any authenticated user with inventory.edit permission can top-up.
 * Always writes an AuditLog entry.
 *
 * @returns {{ product, stock_before, stock_after, added }}
 */
export async function addStock(productId, quantity, reason, {
  userId = null,
  notes = null,
  session = null,
} = {}) {
  const validTopUpReasons = ["stock_in", "recount", "audit_correction"];
  if (!validTopUpReasons.includes(reason)) {
    throw new AppError(
      `Invalid stock top-up reason '${reason}'. Allowed for stock-in: ${validTopUpReasons.join(", ")}`,
      400
    );
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
    throw new AppError("Quantity must be a positive integer", 400);
  }

  const product = await ProductMaster
    .findOne({ _id: productId, is_active: true })
    .session(session);

  if (!product) {
    throw new AppError(`Product (ID: ${productId}) not found or inactive`, 404);
  }

  const stockBefore = product.current_stock;
  product._stockBefore = stockBefore;
  product.current_stock = stockBefore + qty;
  await product.save({ session });

  await writeStockAuditLog({
    userId,
    action: "stock_top_up",
    product,
    delta: qty,
    reason,
    override: false,
    notes,
    session,
  });

  return {
    product: product.toSafeObject(),
    stock_before: stockBefore,
    stock_after: product.current_stock,
    added: qty,
  };
}

/**
 * Convenience: resolve permissions from userId if caller didn't pre-load them.
 * Use inside route handlers that don't already run requirePermission middleware.
 */
export async function resolvePermissionsForUser(userId) {
  if (!userId) return [];
  return resolveUserPermissions(userId);
}
