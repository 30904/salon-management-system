import mongoose from "mongoose";

const productMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: "piece",
      maxlength: 32,
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
productMasterSchema.index({ is_active: 1, name: 1 });

productMasterSchema.statics.isLowStock = function isLowStock(product) {
  if (!product) return false;
  const stock = Number(product.current_stock ?? 0);
  const reorder = Number(product.reorder_level ?? 0);
  return stock <= reorder;
};

productMasterSchema.statics.lowStockFilter = function lowStockFilter() {
  return {
    is_active: true,
    $expr: { $lte: ["$current_stock", "$reorder_level"] },
  };
};

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
    is_low_stock: this.constructor.isLowStock(this),
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const ProductMaster = mongoose.model("ProductMaster", productMasterSchema);

export default ProductMaster;
