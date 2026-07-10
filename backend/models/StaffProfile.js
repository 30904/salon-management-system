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
    specialization: [
      {
        type: String,
        trim: true,
      },
    ],
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
    shift_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftMaster",
      default: null,
    },
    joining_date: {
      type: Date,
      default: Date.now,
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
  return {
    id: this._id,
    user_id: this.user_id,
    designation: this.designation,
    specialization: this.specialization,
    commission_slab_id: this.commission_slab_id,
    base_salary: this.base_salary,
    shift_id: this.shift_id,
    joining_date: this.joining_date,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const StaffProfile = mongoose.model("StaffProfile", staffProfileSchema);

export default StaffProfile;
