import mongoose from "mongoose";

export const INVOICE_PAYMENT_MODES = [
  "cash",
  "card",
  "upi",
  "package_credits",
  "split",
  "other",
];

export const INVOICE_PAYMENT_STATUSES = [
  "paid",
  "unpaid",
  "partial",
  "refunded",
  "void",
];

const splitPaymentSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: INVOICE_PAYMENT_MODES.filter((m) => m !== "split"),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reference_id: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoice_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customer_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    customer_phone: {
      type: String,
      trim: true,
      default: null,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    billing_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totals: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      discount_total: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      tax_total: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      grand_total: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      amount_paid: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      amount_due: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
    },
    payment_mode: {
      type: String,
      enum: INVOICE_PAYMENT_MODES,
      required: true,
      default: "cash",
    },
    payment_status: {
      type: String,
      enum: INVOICE_PAYMENT_STATUSES,
      required: true,
      default: "paid",
    },
    split_payments: {
      type: [splitPaymentSchema],
      default: [],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ customer_id: 1, billing_date: -1 });
invoiceSchema.index({ branch_id: 1, billing_date: -1 });
invoiceSchema.index({ payment_status: 1, billing_date: -1 });
invoiceSchema.index({ billing_date: -1 });

invoiceSchema.methods.toSafeObject = function toSafeObject(lineItems = null) {
  const customer = this.customer_id;
  const branch = this.branch_id;
  const createdBy = this.created_by;

  return {
    id: this._id,
    invoice_number: this.invoice_number,
    customer_id: customer?._id || this.customer_id,
    customer_name: this.customer_name,
    customer_phone: this.customer_phone,
    branch_id: branch?._id || this.branch_id,
    billing_date: this.billing_date,
    totals: this.totals,
    subtotal: this.totals?.subtotal ?? 0,
    discount_total: this.totals?.discount_total ?? 0,
    tax_total: this.totals?.tax_total ?? 0,
    grand_total: this.totals?.grand_total ?? 0,
    amount_paid: this.totals?.amount_paid ?? 0,
    amount_due: this.totals?.amount_due ?? 0,
    payment_mode: this.payment_mode,
    payment_status: this.payment_status,
    split_payments: this.split_payments,
    created_by: createdBy?._id || this.created_by,
    notes: this.notes,
    ...(lineItems !== null && {
      line_items: Array.isArray(lineItems)
        ? lineItems.map((item) => (typeof item.toSafeObject === "function" ? item.toSafeObject() : item))
        : lineItems,
    }),
    customer:
      customer && typeof customer === "object" && customer._id
        ? {
            id: customer._id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
    branch:
      branch && typeof branch === "object" && branch._id
        ? {
            id: branch._id,
            name: branch.name,
            code: branch.code,
          }
        : null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
