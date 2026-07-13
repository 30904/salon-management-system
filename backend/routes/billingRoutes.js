import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireOwnerOrManager } from "../middleware/requireOwnerOrManager.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  createInvoiceHandler,
  listInvoicesHandler,
  getInvoiceHandler,
  voidInvoiceHandler,
} from "../controllers/billingController.js";

const router = Router();

// All billing routes require authentication
router.use(authenticate);

/**
 * POST /api/invoices
 * Create a new invoice atomically.
 *
 * Body:
 *   customer_id?       — ObjectId  (optional, walk-in if omitted)
 *   customer_name      — string    (required)
 *   customer_phone?    — string
 *   branch_id?         — ObjectId
 *   billing_date?      — ISO date  (defaults to now)
 *   payment_mode       — "cash" | "card" | "upi" | "package_credits" | "split" | "other"
 *   payment_status     — "paid" | "unpaid" | "partial"
 *   split_payments?    — [{ mode, amount, reference_id? }]  (required when payment_mode="split")
 *   notes?             — string
 *
 *   line_items[]       — array (min 1 item):
 *     item_type        — "service" | "product" | "package" | "custom"
 *     item_id?         — ObjectId ref to ServiceMaster / ProductMaster / PackageMaster
 *     item_name        — string (required)
 *     staff_id         — ObjectId ref to StaffProfile (required, per line)
 *     quantity         — integer ≥ 1
 *     unit_price       — number ≥ 0
 *     discount_amount? — number (defaults to 0)
 *     tax_master_id?   — ObjectId (if set, fetches rate from TaxMaster; otherwise auto-resolved)
 *     tax_rate?        — number   (fallback if no tax_master_id and no auto-match)
 *     commission_amount? — explicit commission override (skips slab calculation)
 *     package_redemption_id? — ObjectId ref to CustomerPackage
 *     notes?           — string
 *
 * Behaviour:
 *   - GST / tax is resolved from TaxMaster (by tax_master_id → auto-match by item_type → tax_rate fallback)
 *   - Product items: pre-flight stock check blocks request if current_stock < quantity
 *   - Package items: credits deducted atomically; status set to "exhausted" if credits reach 0
 *   - Commission entries created automatically per line item using staff's CommissionSlab
 *   - All writes (Invoice, LineItems, Stock, Credits, Commissions) are a single atomic transaction
 */
router.post("/", asyncHandler(createInvoiceHandler));

/**
 * GET /api/invoices
 * List invoices with optional filters and pagination.
 *
 * Query params:
 *   customer_id?      — filter by customer
 *   branch_id?        — filter by branch
 *   payment_status?   — "paid" | "unpaid" | "partial" | "void"
 *   payment_mode?     — "cash" | "card" | etc.
 *   start_date?       — ISO date (billing_date >=)
 *   end_date?         — ISO date (billing_date <=)
 *   q?                — search in invoice_number, customer_name, customer_phone
 *   page?             — page number (default: 1)
 *   limit?            — page size (default: 20, max: 100)
 */
router.get("/", asyncHandler(listInvoicesHandler));

/**
 * GET /api/invoices/:id
 * Get single invoice with all line items, staff, and customer populated.
 */
router.get("/:id", asyncHandler(getInvoiceHandler));

/**
 * POST /api/invoices/:id/void
 * Void / cancel an invoice. Restricted to Owner/Manager.
 * Atomically reverses: product stock, package credits, commission entries.
 *
 * Body:
 *   reason?   — string  (appended to invoice notes)
 */
router.post("/:id/void", requireOwnerOrManager, asyncHandler(voidInvoiceHandler));

export default router;
