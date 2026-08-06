import mongoose from "mongoose";

/**
 * Optional per-month override of staff sales targets.
 * If missing, targets fall back to StaffProfile.monthly_target_1 / monthly_target_2
 * (or 5× / 7× base_salary).
 */
const staffMonthlyTargetSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
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
      max: 2100,
    },
    target_1_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    target_2_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    set_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

staffMonthlyTargetSchema.index({ staff_id: 1, year: 1, month: 1 }, { unique: true });

staffMonthlyTargetSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    staff_id: this.staff_id,
    month: this.month,
    year: this.year,
    target_1_amount: this.target_1_amount,
    target_2_amount: this.target_2_amount,
    notes: this.notes,
    set_by: this.set_by,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const StaffMonthlyTarget = mongoose.model("StaffMonthlyTarget", staffMonthlyTargetSchema);

export default StaffMonthlyTarget;
