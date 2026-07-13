import mongoose from "mongoose";

const commissionSlabSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["percentage", "flat", "tiered", "threshold"],
      default: "percentage",
    },
    rules_json: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

commissionSlabSchema.index({ name: 1 }, { unique: true });
commissionSlabSchema.index({ is_active: 1 });

commissionSlabSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    rules_json: this.rules_json,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const CommissionSlab = mongoose.model("CommissionSlab", commissionSlabSchema);

export default CommissionSlab;
