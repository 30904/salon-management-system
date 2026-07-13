import mongoose from "mongoose";

export const INVOICE_LINE_ITEM_TYPES = ["service", "product", "package", "custom"];

const invoiceLineItemSchema = new mongoose.Schema(
  {
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    item_type: {
      type: String,
      enum: INVOICE_LINE_ITEM_TYPES,
      required: true,
      default: "service",
    },
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    item_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount_amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    tax_amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    tax_rate: {
      type: Number,
      min: 0,
      default: 0,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    package_redemption_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerPackage",
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

invoiceLineItemSchema.index({ invoice_id: 1 });
invoiceLineItemSchema.index({ staff_id: 1, createdAt: -1 });
invoiceLineItemSchema.index({ item_type: 1, item_id: 1 });
invoiceLineItemSchema.index({ package_redemption_id: 1 });

invoiceLineItemSchema.methods.toSafeObject = function toSafeObject() {
  const staff = this.staff_id;
  const packageRedemption = this.package_redemption_id;

  return {
    id: this._id,
    invoice_id: this.invoice_id,
    item_type: this.item_type,
    item_id: this.item_id,
    item_name: this.item_name,
    quantity: this.quantity,
    unit_price: this.unit_price,
    discount_amount: this.discount_amount,
    tax_amount: this.tax_amount,
    tax_rate: this.tax_rate,
    total_amount: this.total_amount,
    staff_id: staff?._id || this.staff_id,
    package_redemption_id: packageRedemption?._id || this.package_redemption_id,
    notes: this.notes,
    staff:
      staff && typeof staff === "object" && staff._id
        ? {
            id: staff._id,
            name:
              staff.full_name ||
              (staff.user_id && typeof staff.user_id === "object" ? staff.user_id.name : "Staff"),
            full_name:
              staff.full_name ||
              (staff.user_id && typeof staff.user_id === "object" ? staff.user_id.name : "Staff"),
            phone:
              staff.phone ||
              (staff.user_id && typeof staff.user_id === "object" ? staff.user_id.phone : null),
            designation: staff.designation,
            role_title: staff.role_title || staff.designation || null,
          }
        : null,
    package_redemption:
      packageRedemption && typeof packageRedemption === "object" && packageRedemption._id
        ? {
            id: packageRedemption._id,
            package_master_id: packageRedemption.package_master_id,
            credits_remaining: packageRedemption.credits_remaining,
            status: packageRedemption.status,
          }
        : null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const InvoiceLineItem = mongoose.model("InvoiceLineItem", invoiceLineItemSchema);

export default InvoiceLineItem;
