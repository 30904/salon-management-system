import TaxMaster from "../models/TaxMaster.js";
import ProductMaster from "../models/ProductMaster.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import {
  createInvoice,
  getInvoiceById,
  getInvoices,
  voidInvoice,
} from "../services/billingService.js";
import { batchValidatePackageRedemptions } from "../services/packageRedemptionService.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_PAYMENT_MODES = ["cash", "card", "upi", "package_credits", "split", "other"];
const VALID_PAYMENT_STATUSES = ["paid", "unpaid", "partial", "refunded"];
const VALID_ITEM_TYPES = ["service", "product", "package", "custom"];

/**
 * Resolve GST / TaxMaster for a line item.
 * Priority:
 *   1. tax_master_id explicitly supplied on the line item  → fetch that record
 *   2. item_type is "service" or "product"                 → find the active default tax
 *      matching the item_type (applies_to: "service"|"product"|"both")
 *   3. tax_rate supplied directly (no TaxMaster lookup)    → use as-is
 *   4. Nothing                                             → 0% tax
 *
 * Returns { tax_rate, tax_amount, tax_label }
 */
async function resolveTax(item) {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unit_price || 0);
  const discountAmount = Number(item.discount_amount || 0);
  const taxableAmount = Math.max(0, unitPrice * quantity - discountAmount);

  // Caller already did TaxMaster lookup and passed rate
  if (item.tax_master_id) {
    const taxRecord = await TaxMaster.findOne({
      _id: item.tax_master_id,
      is_active: true,
    });
    if (!taxRecord) {
      throw new AppError(
        `Tax record (ID: ${item.tax_master_id}) not found or inactive`,
        400
      );
    }
    const rate = Number(taxRecord.rate);
    return {
      tax_rate: rate,
      tax_amount: Number(((taxableAmount * rate) / 100).toFixed(2)),
      tax_label: taxRecord.name,
    };
  }

  // Auto-lookup by item_type
  if (item.item_type === "service" || item.item_type === "product") {
    const defaultTax = await TaxMaster.findOne(
      TaxMaster.appliesToFilter(item.item_type)
    ).sort({ rate: -1 }); // pick highest-rate active match (typically GST 18%)

    if (defaultTax) {
      const rate = Number(defaultTax.rate);
      return {
        tax_rate: rate,
        tax_amount: Number(((taxableAmount * rate) / 100).toFixed(2)),
        tax_label: defaultTax.name,
      };
    }
  }

  // Fallback: use tax_rate from payload directly or default to 18% GST for products/services
  if (item.tax_rate !== undefined && item.tax_rate !== null) {
    const rate = Number(item.tax_rate || 0);
    return {
      tax_rate: rate,
      tax_amount: Number(((taxableAmount * rate) / 100).toFixed(2)),
      tax_label: rate === 18 ? "GST 18%" : rate > 0 ? `GST ${rate}%` : null,
    };
  }

  const defaultRate = item.item_type === "package" ? 0 : 18;
  return {
    tax_rate: defaultRate,
    tax_amount: Number(((taxableAmount * defaultRate) / 100).toFixed(2)),
    tax_label: defaultRate > 0 ? `GST ${defaultRate}%` : null,
  };
}

/**
 * Pre-flight stock check for all product line items.
 * Throws AppError listing every product with insufficient stock — so the
 * caller sees all problems at once rather than discovering them one at a time.
 */
async function prefetchAndCheckStock(lineItems) {
  const productItems = lineItems.filter(
    (item) => item.item_type === "product" && item.item_id
  );

  if (productItems.length === 0) return;

  const insufficientStock = [];

  await Promise.all(
    productItems.map(async (item) => {
      const product = await ProductMaster.findOne({
        _id: item.item_id,
        is_active: true,
      });

      if (!product) {
        insufficientStock.push({
          item_name: item.item_name || String(item.item_id),
          reason: "Product not found or inactive",
          requested: item.quantity,
          available: null,
        });
        return;
      }

      const qty = Number(item.quantity || 1);
      if (product.current_stock < qty) {
        insufficientStock.push({
          item_name: product.name,
          reason: "Insufficient stock",
          requested: qty,
          available: product.current_stock,
        });
      }
    })
  );

  if (insufficientStock.length > 0) {
    throw new AppError(
      `Cannot create invoice: insufficient stock for ${insufficientStock.length} product(s).`,
      400,
      { insufficient_stock: insufficientStock }
    );
  }
}

/**
 * Validate split_payments array for split mode invoices.
 * Ensures the total of split amounts matches grand_total (±1 rounding tolerance).
 */
function validateSplitPayments(splitPayments, grandTotal, paymentMode) {
  if (paymentMode !== "split") return;

  if (!Array.isArray(splitPayments) || splitPayments.length < 2) {
    throw new AppError(
      "Split payment mode requires at least two payment entries in split_payments[]",
      400
    );
  }

  const VALID_SPLIT_MODES = ["cash", "card", "upi", "other"];
  for (const leg of splitPayments) {
    if (!VALID_SPLIT_MODES.includes(leg.mode)) {
      throw new AppError(
        `Invalid split payment mode '${leg.mode}'. Allowed: ${VALID_SPLIT_MODES.join(", ")}`,
        400
      );
    }
    if (!leg.amount || Number(leg.amount) <= 0) {
      throw new AppError(
        `Each split payment entry must have a positive amount. Got: ${leg.amount}`,
        400
      );
    }
  }

  const splitTotal = splitPayments.reduce((sum, leg) => sum + Number(leg.amount), 0);
  if (Math.abs(splitTotal - grandTotal) > 1) {
    throw new AppError(
      `Split payment total (₹${splitTotal.toFixed(2)}) does not match invoice grand total (₹${grandTotal.toFixed(2)})`,
      400
    );
  }
}

// ─── Controller Handlers ────────────────────────────────────────────────────

/**
 * POST /api/invoices
 * Create a new invoice atomically.
 * - Resolves GST/tax from TaxMaster per line item
 * - Pre-checks stock availability for product items (blocks sale if insufficient)
 * - Validates split payment totals
 * - Delegates atomic writes (Invoice + LineItems + Stock deduct + Package credits + Commissions) to billingService
 */
export async function createInvoiceHandler(req, res, next) {
  try {
    const body = req.body;

    // ── 1. Basic top-level validation ──────────────────────────────────────
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
      throw new AppError("At least one line item is required", 400);
    }

    if (body.payment_mode && !VALID_PAYMENT_MODES.includes(body.payment_mode)) {
      throw new AppError(
        `Invalid payment_mode '${body.payment_mode}'. Allowed: ${VALID_PAYMENT_MODES.join(", ")}`,
        400
      );
    }

    if (body.payment_status && !VALID_PAYMENT_STATUSES.includes(body.payment_status)) {
      throw new AppError(
        `Invalid payment_status '${body.payment_status}'. Allowed: ${VALID_PAYMENT_STATUSES.join(", ")}`,
        400
      );
    }

    // ── 2. Validate and enrich each line item with resolved GST tax ─────────
    const taxEnrichedItems = await Promise.all(
      body.line_items.map(async (item, idx) => {
        if (!item.item_name || String(item.item_name).trim() === "") {
          throw new AppError(`Line item at index ${idx} is missing item_name`, 400);
        }
        if (!item.staff_id) {
          throw new AppError(
            `Line item '${item.item_name}' (index ${idx}) is missing required staff_id`,
            400
          );
        }
        if (item.item_type && !VALID_ITEM_TYPES.includes(item.item_type)) {
          throw new AppError(
            `Line item '${item.item_name}' has invalid item_type '${item.item_type}'. Allowed: ${VALID_ITEM_TYPES.join(", ")}`,
            400
          );
        }

        const quantity = Number(item.quantity || 1);
        if (quantity < 1 || !Number.isInteger(quantity)) {
          throw new AppError(
            `Line item '${item.item_name}' quantity must be a positive integer, got: ${item.quantity}`,
            400
          );
        }
        if (Number(item.unit_price || 0) < 0) {
          throw new AppError(
            `Line item '${item.item_name}' unit_price cannot be negative`,
            400
          );
        }

        // Resolve tax via TaxMaster (GST auto-lookup or explicit override)
        const resolvedTax = await resolveTax(item);

        return {
          ...item,
          quantity,
          unit_price: Number(item.unit_price || 0),
          discount_amount: Number(item.discount_amount || 0),
          tax_rate: resolvedTax.tax_rate,
          tax_amount: resolvedTax.tax_amount,
          tax_label: resolvedTax.tax_label,
          total_amount: Number(
            (
              Math.max(0, Number(item.unit_price || 0) * quantity - Number(item.discount_amount || 0)) +
              resolvedTax.tax_amount
            ).toFixed(2)
          ),
        };
      })
    );

    // ── 3. Package redemption pre-flight ────────────────────────────────────
    //    Validates all packages (ownership, status, expiry, credits) in one
    //    parallel batch BEFORE entering the atomic transaction.
    //    Also computes pricing adjustments:
    //      prepaid_bundle → line total set to ₹0 (full cover)
    //      membership     → percentage or flat discount applied from discount_logic_json
    const packageRedemptionMap = await batchValidatePackageRedemptions(
      taxEnrichedItems,
      body.customer_id || null
    );

    // Apply package pricing adjustments to each line item
    const enrichedLineItems = taxEnrichedItems.map((item) => {
      if (!item.package_redemption_id) return item;

      const pkgId = String(item.package_redemption_id);
      const resolved = packageRedemptionMap.get(pkgId);
      if (!resolved) return item; // shouldn't happen — pre-flight already threw

      const { pricing, packageMaster } = resolved;

      // For full_cover (prepaid_bundle): tax is also waived — customer pays ₹0
      // For discount_pct/flat_cover (membership): tax still applies on discounted amount
      const finalTaxAmount = pricing.package_covers_tax
        ? 0
        : item.tax_amount;

      const finalTaxRate = pricing.package_covers_tax ? 0 : item.tax_rate;

      return {
        ...item,
        discount_amount: pricing.adjusted_discount_amount,
        total_amount: pricing.adjusted_total_amount,
        tax_amount: finalTaxAmount,
        tax_rate: finalTaxRate,
        // Attach redemption metadata so billingService.js can store it on InvoiceLineItem
        _package_pricing: pricing,
        _package_master_name: packageMaster.name,
        _package_master_type: packageMaster.type,
      };
    });

    // ── 4. Pre-flight stock check — blocks invoice if stock is insufficient ─
    await prefetchAndCheckStock(enrichedLineItems);

    // ── 5. Recompute invoice-level totals from fully enriched line items ────
    const subtotal = enrichedLineItems.reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0
    );
    const discountTotal = enrichedLineItems.reduce(
      (sum, item) => sum + item.discount_amount,
      0
    );
    const taxTotal = enrichedLineItems.reduce(
      (sum, item) => sum + item.tax_amount,
      0
    );
    const grandTotal = Number((Math.max(0, subtotal - discountTotal + taxTotal)).toFixed(2));

    const paymentMode = body.payment_mode || "cash";
    const paymentStatus = body.payment_status || "paid";
    const amountPaid = body.totals?.amount_paid !== undefined
      ? Number(body.totals.amount_paid)
      : paymentStatus === "paid"
        ? grandTotal
        : paymentStatus === "partial"
          ? Number(body.amount_paid || 0)
          : 0;
    const amountDue = Number(Math.max(0, grandTotal - amountPaid).toFixed(2));

    // ── 6. Validate split payments ──────────────────────────────────────────
    validateSplitPayments(body.split_payments, grandTotal, paymentMode);

    // ── 7. Build final payload for billingService.createInvoice ────────────
    const invoicePayload = {
      ...body,
      line_items: enrichedLineItems,
      totals: { subtotal, discount_total: discountTotal, tax_total: taxTotal, grand_total: grandTotal, amount_paid: amountPaid, amount_due: amountDue },
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      split_payments: Array.isArray(body.split_payments) ? body.split_payments : [],
      strict_stock_check: true,
    };

    const result = await createInvoice(invoicePayload, { userId: req.user?._id });

    return sendSuccess(res, {
      status: 201,
      data: result,
      message: "Invoice created successfully",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/invoices
 * List invoices with optional filters and pagination.
 */
export async function listInvoicesHandler(req, res, next) {
  try {
    const filters = {
      customer_id: req.query.customer_id,
      branch_id: req.query.branch_id,
      payment_status: req.query.payment_status,
      payment_mode: req.query.payment_mode,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      search: req.query.q,
    };

    const pagination = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };

    const result = await getInvoices(filters, pagination);

    return sendSuccess(res, {
      data: result.invoices,
      pagination: result.pagination,
      message: `Found ${result.pagination.total} invoice(s)`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/invoices/:id
 * Get a single invoice with line items and populated refs.
 */
export async function getInvoiceHandler(req, res, next) {
  try {
    const invoice = await getInvoiceById(req.params.id);
    return sendSuccess(res, {
      data: invoice,
      message: "Invoice retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/invoices/:id/void
 * Void/cancel an invoice (Owner/Manager only).
 * Atomically reverses: stock, package credits, commission entries.
 */
export async function voidInvoiceHandler(req, res, next) {
  try {
    const result = await voidInvoice(req.params.id, {
      reason: req.body?.reason || "",
      userId: req.user?._id,
    });

    return sendSuccess(res, {
      data: result,
      message: "Invoice voided successfully. All stock and package credits have been restored.",
    });
  } catch (err) {
    next(err);
  }
}
