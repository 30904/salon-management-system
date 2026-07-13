import ProductMaster from "../models/ProductMaster.js";
import AuditLog from "../models/AuditLog.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import {
  deductStock,
  addStock,
  ADJUSTMENT_REASONS,
  resolvePermissionsForUser,
} from "../services/stockService.js";
import { resolveUserPermissions } from "../services/permissionService.js";

// ─── GET /api/inventory ──────────────────────────────────────────────────────
/**
 * List all products with stock levels and low-stock flag.
 * Supports filtering by ?low_stock=true, ?search=, ?is_active=
 */
export async function listInventoryHandler(req, res, next) {
  try {
    const query = {};

    if (req.query.is_active !== undefined) {
      query.is_active = req.query.is_active !== "false";
    }

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { sku: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.low_stock === "true") {
      query.$expr = { $lte: ["$current_stock", "$reorder_level"] };
    }

    const products = await ProductMaster.find(query).sort({ name: 1 });

    return sendSuccess(res, {
      data: products.map((p) => p.toSafeObject()),
      message: `Found ${products.length} product(s) in inventory`,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/inventory/:id ──────────────────────────────────────────────────
/**
 * Get a single product's stock details.
 */
export async function getInventoryProductHandler(req, res, next) {
  try {
    const product = await ProductMaster.findById(req.params.id);
    if (!product) throw new AppError("Product not found", 404);

    return sendSuccess(res, {
      data: product.toSafeObject(),
      message: "Product retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/inventory/:id/deduct ─────────────────────────────────────────
/**
 * Manual stock deduction (not POS-triggered).
 *
 * Body:
 *   quantity        — integer ≥ 1
 *   reason          — "manual_deduct" | "damage" | "shrinkage" | "audit_correction" | "return_to_vendor"
 *   notes?          — free text
 *   force_override? — boolean (true = allow going below 0 floor; requires inventory.approve permission)
 *
 * Behaviour:
 *   - Normal: blocks if current_stock < quantity → 400 with can_override flag
 *   - force_override: true → checks requester has inventory.approve; floors stock at 0; AuditLog.override_used=true
 *   - Always writes AuditLog entry regardless of path
 *
 * Access:
 *   - Requires inventory.edit permission (to perform any deduction)
 *   - Additionally requires inventory.approve when force_override = true
 */
export async function deductStockHandler(req, res, next) {
  try {
    const { quantity, reason, notes, force_override } = req.body;

    if (!quantity) throw new AppError("quantity is required", 400);
    if (!reason) throw new AppError("reason is required", 400);

    // Resolve the acting user's permissions (pre-loaded by middleware or resolved here)
    const permissions =
      req.permissions || (await resolveUserPermissions(req.user._id));

    const result = await deductStock(
      req.params.id,
      Number(quantity),
      reason,
      {
        override: Boolean(force_override),
        permissions,
        userId: req.user._id,
        notes: notes || null,
      }
    );

    const message = result.override_used
      ? `Stock override applied by manager: '${result.product.name}' reduced by ${result.deducted} unit(s) ` +
        `(was ${result.stock_before}, now ${result.stock_after}). AuditLog entry created.`
      : `Stock deducted: '${result.product.name}' reduced by ${result.deducted} unit(s) ` +
        `(was ${result.stock_before}, now ${result.stock_after}).`;

    return sendSuccess(res, {
      data: {
        product: result.product,
        adjustment: {
          type: "deduct",
          quantity: result.deducted,
          stock_before: result.stock_before,
          stock_after: result.stock_after,
          reason,
          override_used: result.override_used,
          notes: notes || null,
        },
      },
      message,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/inventory/:id/top-up ─────────────────────────────────────────
/**
 * Stock top-up / stock-in.
 *
 * Body:
 *   quantity   — integer ≥ 1
 *   reason     — "stock_in" | "recount" | "audit_correction"
 *   notes?     — free text
 *
 * Access: requires inventory.edit
 */
export async function topUpStockHandler(req, res, next) {
  try {
    const { quantity, reason, notes } = req.body;

    if (!quantity) throw new AppError("quantity is required", 400);
    if (!reason) throw new AppError("reason is required", 400);

    const result = await addStock(
      req.params.id,
      Number(quantity),
      reason,
      {
        userId: req.user._id,
        notes: notes || null,
      }
    );

    return sendSuccess(res, {
      data: {
        product: result.product,
        adjustment: {
          type: "top_up",
          quantity: result.added,
          stock_before: result.stock_before,
          stock_after: result.stock_after,
          reason,
          notes: notes || null,
        },
      },
      message: `Stock topped up: '${result.product.name}' increased by ${result.added} unit(s) ` +
        `(was ${result.stock_before}, now ${result.stock_after}).`,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/inventory/:id/audit-log ───────────────────────────────────────
/**
 * View the audit trail for a specific product's stock movements.
 *
 * Query:
 *   page?   — default 1
 *   limit?  — default 20, max 100
 *
 * Access: requires inventory.view
 */
export async function getProductAuditLogHandler(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({
        entity: "ProductMaster",
        entity_id: req.params.id,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user_id", "name email"),
      AuditLog.countDocuments({
        entity: "ProductMaster",
        entity_id: req.params.id,
      }),
    ]);

    return sendSuccess(res, {
      data: logs.map((log) => ({
        id: log._id,
        action: log.action,
        user: log.user_id
          ? { id: log.user_id._id, name: log.user_id.name, email: log.user_id.email }
          : null,
        details: log.details_json,
        timestamp: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      message: `Found ${total} audit log entries for this product`,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/inventory/meta/reasons ─────────────────────────────────────────
/**
 * Return valid adjustment reasons (so front-end can populate dropdowns).
 */
export async function getAdjustmentReasonsHandler(req, res, next) {
  try {
    return sendSuccess(res, {
      data: ADJUSTMENT_REASONS,
      message: "Valid stock adjustment reasons",
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/inventory/stock-report ────────────────────────────────────────
/**
 * Generate a comprehensive stock report reading directly from ProductMaster.
 * Returns:
 *   - summary: Total products, stock units, valuation at cost/sale price, and reorder alerts count
 *   - reorder_alerts: List of products currently at or below their reorder_level (with recommended reorder quantity and status)
 *   - products: Full itemized stock report with status ("in_stock", "low_stock", "out_of_stock") and item values
 *
 * Query params:
 *   status?   — "all" | "low_stock" | "out_of_stock" | "in_stock" (filters the `products` list; reorder_alerts and summary reflect the filtered scope or full scope as appropriate)
 *   search?   — text search on name or SKU
 */
export async function getStockReportHandler(req, res, next) {
  try {
    const query = { is_active: true };

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { sku: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.status === "out_of_stock") {
      query.current_stock = 0;
    } else if (req.query.status === "low_stock") {
      query.$expr = { $lte: ["$current_stock", "$reorder_level"] };
    } else if (req.query.status === "in_stock") {
      query.$expr = { $gt: ["$current_stock", "$reorder_level"] };
    }

    const products = await ProductMaster.find(query).sort({ name: 1 });

    let totalStockUnits = 0;
    let totalPurchaseValue = 0;
    let totalSaleValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const reorderAlerts = [];
    const reportItems = products.map((product) => {
      const stock = Number(product.current_stock ?? 0);
      const reorder = Number(product.reorder_level ?? 0);
      const cost = Number(product.purchase_price ?? 0);
      const sale = Number(product.sale_price ?? 0);

      const itemPurchaseVal = Number((stock * cost).toFixed(2));
      const itemSaleVal = Number((stock * sale).toFixed(2));

      totalStockUnits += stock;
      totalPurchaseValue += itemPurchaseVal;
      totalSaleValue += itemSaleVal;

      const isOutOfStock = stock === 0;
      const isLowStock = stock <= reorder;

      let status = "in_stock";
      if (isOutOfStock) {
        status = "out_of_stock";
        outOfStockCount++;
      } else if (isLowStock) {
        status = "low_stock";
        lowStockCount++;
      }

      if (isLowStock) {
        const deficit = Math.max(0, reorder - stock);
        const recommendedQty = Math.max(10, deficit > 0 ? deficit * 2 : 10);
        reorderAlerts.push({
          id: product._id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          current_stock: stock,
          reorder_level: reorder,
          deficit,
          recommended_order_quantity: recommendedQty,
          purchase_price: cost,
          status,
          alert_message: isOutOfStock
            ? `CRITICAL: '${product.name}' (${product.sku}) is completely OUT OF STOCK!`
            : `LOW STOCK: '${product.name}' (${product.sku}) has ${stock} ${product.unit}(s) left (Reorder Level: ${reorder}).`,
        });
      }

      return {
        id: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        purchase_price: cost,
        sale_price: sale,
        current_stock: stock,
        reorder_level: reorder,
        status,
        is_low_stock: isLowStock,
        total_purchase_value: itemPurchaseVal,
        total_sale_value: itemSaleVal,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      };
    });

    // Sort reorderAlerts with out_of_stock first, then by deficit descending
    reorderAlerts.sort((a, b) => {
      if (a.status === "out_of_stock" && b.status !== "out_of_stock") return -1;
      if (a.status !== "out_of_stock" && b.status === "out_of_stock") return 1;
      return b.deficit - a.deficit;
    });

    return sendSuccess(res, {
      data: {
        summary: {
          total_products: products.length,
          total_stock_units: totalStockUnits,
          total_stock_value_at_purchase: Number(totalPurchaseValue.toFixed(2)),
          total_stock_value_at_sale: Number(totalSaleValue.toFixed(2)),
          low_stock_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
          reorder_alerts_count: reorderAlerts.length,
          generated_at: new Date(),
        },
        reorder_alerts: reorderAlerts,
        products: reportItems,
      },
      message: `Stock report generated: ${reorderAlerts.length} reorder alert(s) across ${products.length} product(s)`,
    });
  } catch (err) {
    next(err);
  }
}

