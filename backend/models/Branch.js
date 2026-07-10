import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

branchSchema.index({ is_active: 1 });

branchSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    code: this.code,
    name: this.name,
    address: this.address,
    phone: this.phone,
    is_active: this.is_active,
    created_at: this.createdAt,
  };
};

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
