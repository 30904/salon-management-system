/**
 * Feature 4 — Service redo / rework request.
 * Tracks original paid service line → approval → ₹0 redo visit + product cost for payroll.
 */
import mongoose from "mongoose";

export const REDO_REQUEST_STATUSES = Object.freeze([
  "pending_approval",
  "approved",
  "rejected",
  "completed",
]);

const redoProductUsedSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductMaster",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    /** ProductMaster.purchase_price snapshotted at complete time. */
    cost_price_snapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    /** quantity × cost_price_snapshot */
    total_cost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const redoRequestSchema = new mongoose.Schema(
  {
    original_invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    original_line_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      required: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    original_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    /** Staff who performs the redo (may equal original_staff_id). Payroll cost target (4.7a). */
    redo_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    /** ₹0 invoice created when the redo visit is completed. */
    redo_invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    status: {
      type: String,
      enum: REDO_REQUEST_STATUSES,
      default: "pending_approval",
      required: true,
    },
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    products_used: {
      type: [redoProductUsedSchema],
      default: [],
    },
    /** Sum of products_used[].total_cost — charged to redo_staff_id when payroll gate is ON. */
    total_product_cost: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Set when pulled into a payroll run (idempotency, mirrors CommissionEntry). */
    payroll_run_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      default: null,
    },
  },
  { timestamps: true }
);

redoRequestSchema.index({ original_line_item_id: 1, status: 1 });
redoRequestSchema.index({ status: 1, createdAt: -1 });
redoRequestSchema.index({ redo_staff_id: 1, status: 1, payroll_run_id: 1 });
redoRequestSchema.index({ customer_id: 1, createdAt: -1 });
redoRequestSchema.index({ original_invoice_id: 1 });

redoRequestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    original_invoice_id: this.original_invoice_id?._id || this.original_invoice_id,
    original_line_item_id: this.original_line_item_id?._id || this.original_line_item_id,
    customer_id: this.customer_id?._id || this.customer_id,
    original_staff_id: this.original_staff_id?._id || this.original_staff_id,
    redo_staff_id: this.redo_staff_id?._id || this.redo_staff_id,
    redo_invoice_id: this.redo_invoice_id?._id || this.redo_invoice_id,
    status: this.status,
    requested_by: this.requested_by?._id || this.requested_by,
    approved_by: this.approved_by?._id || this.approved_by,
    approved_at: this.approved_at,
    reason: this.reason || "",
    products_used: (this.products_used || []).map((row) => ({
      product_id: row.product_id?._id || row.product_id,
      quantity: row.quantity,
      cost_price_snapshot: row.cost_price_snapshot,
      total_cost: row.total_cost,
    })),
    total_product_cost: this.total_product_cost ?? 0,
    payroll_run_id: this.payroll_run_id?._id || this.payroll_run_id,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const RedoRequest = mongoose.model("RedoRequest", redoRequestSchema);

export default RedoRequest;
