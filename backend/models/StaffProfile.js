import mongoose from "mongoose";

const staffProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: [String],
      default: [],
    },
    commission_slab_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionSlab",
      default: null,
    },
    base_salary: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Recurring monthly sales Target 1 (₹). 0 = fall back to 5× base_salary */
    monthly_target_1: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Recurring monthly sales Target 2 (₹). 0 = fall back to 7× base_salary */
    monthly_target_2: {
      type: Number,
      default: 0,
      min: 0,
    },
    shift_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftMaster",
      default: null,
    },
    joining_date: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

staffProfileSchema.index({ user_id: 1 }, { unique: true });
staffProfileSchema.index({ is_active: 1 });
staffProfileSchema.index({ designation: 1 });

staffProfileSchema.methods.toSafeObject = function toSafeObject() {
  const user = this.user_id;

  return {
    id: this._id,
    user_id: user?._id || this.user_id,
    designation: this.designation,
    specialization: this.specialization,
    base_salary: this.base_salary,
    monthly_target_1: this.monthly_target_1,
    monthly_target_2: this.monthly_target_2,
    commission_slab_id: this.commission_slab_id,
    shift_id: this.shift_id,
    joining_date: this.joining_date,
    is_active: this.is_active,
    user:
      user && typeof user === "object" && user._id
        ? {
            id: user._id,
            name: user.name,
            phone: user.phone,
            email: user.email,
          }
        : null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const StaffProfile = mongoose.model("StaffProfile", staffProfileSchema);

export default StaffProfile;
