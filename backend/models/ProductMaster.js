import mongoose from "mongoose";

const productMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: "piece",
    },
    purchase_price: {
      type: Number,
      required: true,
      min: 0,
    },
    sale_price: {
      type: Number,
      required: true,
      min: 0,
    },
    current_stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reorder_level: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productMasterSchema.index({ sku: 1 }, { unique: true });
productMasterSchema.index({ is_active: 1, current_stock: 1 });

productMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    sku: this.sku,
    unit: this.unit,
    purchase_price: this.purchase_price,
    sale_price: this.sale_price,
    current_stock: this.current_stock,
    reorder_level: this.reorder_level,
    is_active: this.is_active,
    created_at: this.createdAt,
  };
};

const ProductMaster = mongoose.model("ProductMaster", productMasterSchema);

export default ProductMaster;
