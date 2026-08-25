import mongoose from "mongoose";
import { PACKAGE_TYPE_AMOUNT_WALLET } from "../constants/packageConstants.js";

export const PACKAGE_MASTER_TYPES = [
  "prepaid_bundle",
  "membership",
  "amount_wallet",
];

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
      enum: PACKAGE_MASTER_TYPES,
      default: "prepaid_bundle",
    },
    validity_days: {
      type: Number,
      default: 30,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * Rupee balance credited on amount_wallet purchase (Buy X Get Y → wallet_value = Y total).
     * Unused for prepaid_bundle / membership.
     */
    wallet_value: {
      type: Number,
      default: null,
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

packageMasterSchema.pre("validate", function ensureWalletFields(next) {
  if (this.type === PACKAGE_TYPE_AMOUNT_WALLET) {
    // Client wallets: no validity. null means never expires.
    if (
      this.validity_days === undefined ||
      this.validity_days === "" ||
      this.validity_days === null ||
      Number(this.validity_days) === 0
    ) {
      this.validity_days = null;
    } else if (!Number.isFinite(Number(this.validity_days)) || Number(this.validity_days) < 1) {
      return next(new Error("validity_days must be null (no expiry) or >= 1"));
    }

    if (this.wallet_value === null || this.wallet_value === undefined || this.wallet_value === "") {
      this.wallet_value = this.price;
    } else if (Number(this.wallet_value) < 0) {
      return next(new Error("wallet_value cannot be negative"));
    }
  } else if (
    this.validity_days === null ||
    this.validity_days === undefined ||
    !Number.isFinite(Number(this.validity_days)) ||
    Number(this.validity_days) < 1
  ) {
    return next(new Error("validity_days must be >= 1 for prepaid_bundle and membership"));
  }

  return next();
});

packageMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    validity_days: this.validity_days ?? null,
    price: this.price,
    wallet_value: this.wallet_value ?? null,
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
