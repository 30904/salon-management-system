import mongoose from "mongoose";

/**
 * Company holiday — Attendance / Leave / Payroll Patch Guide Stage A.
 * Dates are normalized to UTC midnight by callers/services.
 * branch_id null = holiday applies to all branches.
 */
const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true, // UTC midnight
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1, branch_id: 1 }, { unique: true });

holidaySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    date: this.date,
    name: this.name,
    branch_id: this.branch_id?._id || this.branch_id,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Holiday = mongoose.model("Holiday", holidaySchema);

export default Holiday;
