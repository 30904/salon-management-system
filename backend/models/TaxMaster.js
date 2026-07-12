import mongoose from "mongoose";

export const TAX_APPLIES_TO = ["service", "product", "both"];

const taxMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    applies_to: {
      type: String,
      required: true,
      enum: TAX_APPLIES_TO,
      default: "both",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

taxMasterSchema.index({ name: 1 }, { unique: true });
taxMasterSchema.index({ is_active: 1, applies_to: 1 });

taxMasterSchema.statics.appliesToFilter = function appliesToFilter(target) {
  const normalized = String(target).trim().toLowerCase();

  if (!["service", "product"].includes(normalized)) {
    return { is_active: true };
  }

  return {
    is_active: true,
    applies_to: { $in: [normalized, "both"] },
  };
};

taxMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    rate: this.rate,
    applies_to: this.applies_to,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const TaxMaster = mongoose.model("TaxMaster", taxMasterSchema);

export default TaxMaster;
