import mongoose from "mongoose";

const commissionEntrySchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    invoice_line_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvoiceLineItem",
      default: null,
    },
    commission_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    calculated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    payroll_run_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      default: null,
    },
    service_label: {
      type: String,
      trim: true,
      default: null,
    },
    invoice_reference: {
      type: String,
      trim: true,
      default: null,
    },
    line_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

commissionEntrySchema.index({ staff_id: 1, calculated_at: -1 });
commissionEntrySchema.index({ calculated_at: -1 });
commissionEntrySchema.index({ payroll_run_id: 1 });

commissionEntrySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    staff_id: this.staff_id,
    invoice_line_item_id: this.invoice_line_item_id,
    commission_amount: this.commission_amount,
    calculated_at: this.calculated_at,
    payroll_run_id: this.payroll_run_id,
    service_label: this.service_label,
    invoice_reference: this.invoice_reference,
    line_amount: this.line_amount,
    created_at: this.createdAt,
  };
};

const CommissionEntry = mongoose.model("CommissionEntry", commissionEntrySchema);

export default CommissionEntry;
