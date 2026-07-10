import mongoose from "mongoose";

const serviceMasterSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    duration_minutes: {
      type: Number,
      required: true,
      min: 5,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    commission_slab_override_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionSlab",
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

serviceMasterSchema.index({ category_id: 1, name: 1 }, { unique: true });
serviceMasterSchema.index({ is_active: 1 });

serviceMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    category_id: this.category_id,
    name: this.name,
    duration_minutes: this.duration_minutes,
    price: this.price,
    commission_slab_override_id: this.commission_slab_override_id,
    is_active: this.is_active,
    created_at: this.createdAt,
  };
};

const ServiceMaster = mongoose.model("ServiceMaster", serviceMasterSchema);

export default ServiceMaster;
