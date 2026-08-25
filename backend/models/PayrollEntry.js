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
    /** Sum of POS line commissions included in this run (excludes percentage slabs — those are replaced by target bonuses). */
    line_commission_total: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** Service sales used for target progress (CommissionEntry.line_amount sum). */
    sales_achieved: {
      type: Number,
      min: 0,
      default: 0,
    },
    target_1_amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    target_2_amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    target_1_hit: {
      type: Boolean,
      default: false,
    },
    target_2_hit: {
      type: Boolean,
      default: false,
    },
    /** 10% of Target 1 when T1 hit and T2 not hit. */
    target_1_bonus: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** 10% of Target 2 when T2 hit (replaces T1 bonus). */
    target_2_bonus: {
      type: Number,
      min: 0,
      default: 0,
    },
    target_commission_total: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** staff_target = personal T1/T2; manager_salon = whole-salon sales tiers */
    bonus_basis: {
      type: String,
      enum: ["staff_target", "manager_salon"],
      default: "staff_target",
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
    line_commission_total: this.line_commission_total ?? 0,
    sales_achieved: this.sales_achieved ?? 0,
    target_1_amount: this.target_1_amount ?? 0,
    target_2_amount: this.target_2_amount ?? 0,
    target_1_hit: Boolean(this.target_1_hit),
    target_2_hit: Boolean(this.target_2_hit),
    target_1_bonus: this.target_1_bonus ?? 0,
    target_2_bonus: this.target_2_bonus ?? 0,
    target_commission_total: this.target_commission_total ?? 0,
    bonus_basis: this.bonus_basis || "staff_target",
    net_payable: this.net_payable,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const PayrollEntry = mongoose.model("PayrollEntry", payrollEntrySchema);

export default PayrollEntry;
