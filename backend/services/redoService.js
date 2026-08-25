/**
 * Feature 4 — Service redo / rework business logic.
 */
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import ProductMaster from "../models/ProductMaster.js";
import RedoRequest from "../models/RedoRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import {
  REDO_WINDOW_DAYS,
  REDO_ONE_PER_ORIGINAL_LINE,
  REDO_COST_BASIS_FIELD,
} from "../constants/redoConstants.js";
import { deductStock } from "./stockService.js";
import { withTransaction } from "../utils/withTransaction.js";
import { AppError } from "../utils/AppError.js";

/**
 * Create a pending redo request for an original paid service line.
 * Does NOT create invoice, stock movements, or payroll rows.
 */
export async function createRedoRequest({
  originalLineItemId,
  redoStaffId = null,
  reason = "",
  requestedBy,
} = {}) {
  if (!originalLineItemId || !mongoose.Types.ObjectId.isValid(String(originalLineItemId))) {
    throw new AppError("Valid original_line_item_id is required", 400);
  }
  if (!requestedBy || !mongoose.Types.ObjectId.isValid(String(requestedBy))) {
    throw new AppError("requested_by user is required", 400);
  }

  const line = await InvoiceLineItem.findById(originalLineItemId);
  if (!line) {
    throw new AppError("Invoice line item not found", 404);
  }
  if (line.item_type !== "service") {
    throw new AppError("Redo is only allowed for service line items", 400);
  }
  if (line.redo_request_id) {
    throw new AppError("This line is itself a redo visit and cannot be redone", 400);
  }

  const invoice = await Invoice.findById(line.invoice_id);
  if (!invoice) {
    throw new AppError("Parent invoice not found", 404);
  }
  if (invoice.payment_status === "void") {
    throw new AppError("Cannot request redo on a void invoice", 400);
  }
  if (!invoice.customer_id) {
    throw new AppError("Redo requires an invoice with a linked customer", 400);
  }

  const billingMs = new Date(invoice.billing_date).getTime();
  if (!Number.isFinite(billingMs)) {
    throw new AppError("Invoice billing_date is invalid", 400);
  }
  const windowMs = Number(REDO_WINDOW_DAYS) * 24 * 60 * 60 * 1000;
  if (Date.now() - billingMs > windowMs) {
    throw new AppError(
      `Redo window expired. Requests allowed within ${REDO_WINDOW_DAYS} day(s) of the original billing date.`,
      400
    );
  }

  if (REDO_ONE_PER_ORIGINAL_LINE) {
    const existing = await RedoRequest.findOne({
      original_line_item_id: line._id,
      status: { $ne: "rejected" },
    }).select("_id status");
    if (existing) {
      throw new AppError(
        `A redo request already exists for this service line (status: ${existing.status}). Reject it first to request again.`,
        400
      );
    }
  }

  const originalStaffId = line.staff_id;
  let resolvedRedoStaffId = originalStaffId;
  if (redoStaffId != null && String(redoStaffId).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(String(redoStaffId))) {
      throw new AppError("Invalid redo_staff_id", 400);
    }
    const redoStaff = await StaffProfile.findById(redoStaffId).select("_id is_active");
    if (!redoStaff || redoStaff.is_active === false) {
      throw new AppError("Redo staff not found or inactive", 404);
    }
    resolvedRedoStaffId = redoStaff._id;
  }

  const doc = await RedoRequest.create({
    original_invoice_id: invoice._id,
    original_line_item_id: line._id,
    customer_id: invoice.customer_id,
    original_staff_id: originalStaffId,
    redo_staff_id: resolvedRedoStaffId,
    status: "pending_approval",
    requested_by: requestedBy,
    reason: String(reason || "").trim(),
  });

  return doc;
}

async function loadPendingRedoRequest(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError("Invalid redo request id", 400);
  }

  const doc = await RedoRequest.findById(id);
  if (!doc) {
    throw new AppError("Redo request not found", 404);
  }
  if (doc.status !== "pending_approval") {
    throw new AppError(
      `Only pending_approval requests can be approved or rejected (current: ${doc.status})`,
      400
    );
  }
  return doc;
}

/**
 * Approve a pending redo — no invoice / stock / payroll yet (complete records the visit).
 */
export async function approveRedoRequest(id, approvedBy) {
  if (!approvedBy || !mongoose.Types.ObjectId.isValid(String(approvedBy))) {
    throw new AppError("approved_by user is required", 400);
  }

  const doc = await loadPendingRedoRequest(id);
  doc.status = "approved";
  doc.approved_by = approvedBy;
  doc.approved_at = new Date();
  await doc.save();
  return doc;
}

/**
 * Reject a pending redo — no invoice / stock / payroll side effects.
 */
export async function rejectRedoRequest(id, rejectedBy = null) {
  const doc = await loadPendingRedoRequest(id);
  doc.status = "rejected";
  if (rejectedBy && mongoose.Types.ObjectId.isValid(String(rejectedBy))) {
    doc.approved_by = rejectedBy;
    doc.approved_at = new Date();
  }
  await doc.save();
  return doc;
}

/**
 * Complete an approved redo visit:
 * - Snapshot purchase_price × qty for productsUsed (empty → cost 0)
 * - deductStock(..., 'redo') per product
 * - ₹0 paid invoice (payment_mode other) + ₹0 service line (staff = redo_staff)
 * - Skip CommissionEntry
 * - Mark request completed with products_used / total_product_cost / redo_invoice_id
 */
export async function completeRedoRequest(id, { productsUsed = [], userId = null } = {}) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError("Invalid redo request id", 400);
  }

  const usedList = Array.isArray(productsUsed) ? productsUsed : [];

  return withTransaction(
    async (session) => {
      const doc = await RedoRequest.findById(id).session(session);
      if (!doc) {
        throw new AppError("Redo request not found", 404);
      }
      if (doc.status !== "approved") {
        throw new AppError(
          `Only approved redo requests can be completed (current: ${doc.status})`,
          400
        );
      }

      const originalLine = await InvoiceLineItem.findById(doc.original_line_item_id).session(
        session
      );
      if (!originalLine) {
        throw new AppError("Original service line not found", 404);
      }

      const originalInvoice = await Invoice.findById(doc.original_invoice_id).session(session);
      if (!originalInvoice) {
        throw new AppError("Original invoice not found", 404);
      }

      const productSnapshots = [];
      let totalProductCost = 0;

      for (const row of usedList) {
        const productId = row?.product_id || row?.productId;
        const quantity = Number(row?.quantity);

        if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
          throw new AppError("Each productsUsed entry requires a valid product_id", 400);
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new AppError("Each productsUsed quantity must be a positive integer", 400);
        }

        const product = await ProductMaster.findById(productId).session(session);
        if (!product || product.is_active === false) {
          throw new AppError(`Product not found or inactive (${productId})`, 404);
        }

        const costPrice = Number(product[REDO_COST_BASIS_FIELD] ?? product.purchase_price ?? 0);
        if (!Number.isFinite(costPrice) || costPrice < 0) {
          throw new AppError(`Invalid purchase_price on product ${product.name}`, 400);
        }

        const totalCost = Number((quantity * costPrice).toFixed(2));

        await deductStock(productId, quantity, "redo", {
          session,
          userId,
          notes: `Redo request ${doc._id}`,
        });

        productSnapshots.push({
          product_id: product._id,
          quantity,
          cost_price_snapshot: costPrice,
          total_cost: totalCost,
        });
        totalProductCost += totalCost;
      }

      totalProductCost = Number(totalProductCost.toFixed(2));

      const invoiceNumber = `REDO-${Date.now().toString().slice(-8)}-${Math.floor(
        Math.random() * 900 + 100
      )}`;

      const [redoInvoice] = await Invoice.create(
        [
          {
            invoice_number: invoiceNumber,
            customer_id: doc.customer_id,
            customer_name: originalInvoice.customer_name || "Customer",
            customer_phone: originalInvoice.customer_phone || null,
            branch_id: originalInvoice.branch_id || null,
            billing_date: new Date(),
            totals: {
              subtotal: 0,
              discount_total: 0,
              tax_total: 0,
              grand_total: 0,
              amount_paid: 0,
              amount_due: 0,
            },
            payment_mode: "other",
            payment_status: "paid",
            created_by: userId || null,
            notes: `Redo — no charge (original ${originalInvoice.invoice_number})`,
          },
        ],
        { session }
      );

      const [redoLine] = await InvoiceLineItem.create(
        [
          {
            invoice_id: redoInvoice._id,
            item_type: "service",
            item_id: originalLine.item_id || null,
            item_name: originalLine.item_name,
            quantity: 1,
            unit_price: 0,
            discount_amount: 0,
            tax_amount: 0,
            tax_rate: 0,
            total_amount: 0,
            staff_id: doc.redo_staff_id,
            redo_request_id: doc._id,
            notes: "Redo — no charge",
          },
        ],
        { session }
      );

      // Explicitly skip CommissionEntry for ₹0 redo lines.

      doc.products_used = productSnapshots;
      doc.total_product_cost = totalProductCost;
      doc.redo_invoice_id = redoInvoice._id;
      doc.status = "completed";
      await doc.save({ session });

      return {
        redoRequest: doc,
        redoInvoice,
        redoLine,
      };
    },
    { fallbackIfNoReplica: true }
  );
}

/**
 * List redo requests. Optional status / invoice filters.
 */
export async function listRedoRequests({
  status = null,
  limit = 100,
  originalInvoiceId = null,
  redoInvoiceId = null,
} = {}) {
  const filter = {};
  if (status) {
    const statuses = String(status)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (statuses.length === 1) filter.status = statuses[0];
    else if (statuses.length > 1) filter.status = { $in: statuses };
  }
  if (originalInvoiceId && mongoose.Types.ObjectId.isValid(String(originalInvoiceId))) {
    filter.original_invoice_id = originalInvoiceId;
  }
  if (redoInvoiceId && mongoose.Types.ObjectId.isValid(String(redoInvoiceId))) {
    filter.redo_invoice_id = redoInvoiceId;
  }

  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const rows = await RedoRequest.find(filter)
    .populate({ path: "original_staff_id", populate: { path: "user_id", select: "name" } })
    .populate({ path: "redo_staff_id", populate: { path: "user_id", select: "name" } })
    .populate({ path: "original_line_item_id", select: "item_name item_type" })
    .populate({
      path: "original_invoice_id",
      select: "invoice_number billing_date customer_name",
    })
    .populate({ path: "customer_id", select: "name phone" })
    .sort({ createdAt: -1 })
    .limit(cap);

  return rows.map((row) => {
    const base = row.toSafeObject();
    const originalStaff = row.original_staff_id;
    const redoStaff = row.redo_staff_id;
    return {
      ...base,
      service_name: row.original_line_item_id?.item_name || "",
      customer_name:
        row.customer_id?.name || row.original_invoice_id?.customer_name || "",
      invoice_number: row.original_invoice_id?.invoice_number || "",
      billing_date: row.original_invoice_id?.billing_date || null,
      original_staff_name:
        originalStaff?.user_id?.name || originalStaff?.user?.name || "",
      original_staff_designation: originalStaff?.designation || "",
      redo_staff_name: redoStaff?.user_id?.name || redoStaff?.user?.name || "",
      redo_staff_designation: redoStaff?.designation || "",
    };
  });
}

/**
 * Get one redo request by id.
 */
export async function getRedoRequestById(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError("Invalid redo request id", 400);
  }
  const doc = await RedoRequest.findById(id);
  if (!doc) {
    throw new AppError("Redo request not found", 404);
  }
  return doc;
}

export default {
  createRedoRequest,
  approveRedoRequest,
  rejectRedoRequest,
  completeRedoRequest,
  listRedoRequests,
  getRedoRequestById,
};

