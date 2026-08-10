import mongoose from "mongoose";

/**
 * Per-staff line on a PayrollRun — Attendance / Leave / Payroll Patch Guide Stage C.
 * Unique one entry per staff within a run.
 */
const payrollEntrySchema = new mongoose.Schema(
  {
    payroll_run_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
    },
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    base_salary: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    working_days_in_month: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    payable_days: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unpaid_days: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    per_day_rate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deduction_amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    commission_total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    net_payable: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

payrollEntrySchema.index({ payroll_run_id: 1, staff_id: 1 }, { unique: true });
payrollEntrySchema.index({ staff_id: 1 });

payrollEntrySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    payroll_run_id: this.payroll_run_id?._id || this.payroll_run_id,
    staff_id: this.staff_id?._id || this.staff_id,
    base_salary: this.base_salary,
    working_days_in_month: this.working_days_in_month,
    payable_days: this.payable_days,
    unpaid_days: this.unpaid_days,
    per_day_rate: this.per_day_rate,
    deduction_amount: this.deduction_amount,
    commission_total: this.commission_total,
    net_payable: this.net_payable,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const PayrollEntry = mongoose.model("PayrollEntry", payrollEntrySchema);

export default PayrollEntry;
