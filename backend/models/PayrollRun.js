import mongoose from "mongoose";

/**
 * Monthly payroll run — Attendance / Leave / Payroll Patch Guide Stage C.
 * One draft/finalized run per calendar month+year.
 */
export const PAYROLL_RUN_STATUSES = ["draft", "finalized"];

const payrollRunSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    status: {
      type: String,
      enum: PAYROLL_RUN_STATUSES,
      default: "draft",
      required: true,
    },
    run_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    finalized_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

payrollRunSchema.methods.toSafeObject = function toSafeObject() {
  const runBy = this.run_by;

  return {
    id: this._id,
    month: this.month,
    year: this.year,
    status: this.status,
    run_by: runBy?._id || this.run_by,
    finalized_at: this.finalized_at,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const PayrollRun = mongoose.model("PayrollRun", payrollRunSchema);

export default PayrollRun;
