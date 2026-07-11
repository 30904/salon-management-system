import mongoose from "mongoose";

const packageMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["prepaid_bundle", "membership"],
      default: "prepaid_bundle",
    },
    validity_days: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    included_services: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    credit_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount_logic_json: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

packageMasterSchema.index({ branch_id: 1, name: 1 }, { unique: true });
packageMasterSchema.index({ type: 1, is_active: 1 });

packageMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    validity_days: this.validity_days,
    price: this.price,
    included_services: this.included_services,
    credit_count: this.credit_count,
    discount_logic_json: this.discount_logic_json,
    branch_id: this.branch_id,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const PackageMaster = mongoose.model("PackageMaster", packageMasterSchema);

export default PackageMaster;
