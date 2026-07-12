import mongoose from "mongoose";

export const SERVICE_POPULATE = {
  category: { path: "category_id", select: "name is_active" },
};

function refToSafeObject(ref) {
  if (!ref) return null;

  if (typeof ref === "object" && ref._id) {
    return {
      id: ref._id,
      ...(ref.name !== undefined && { name: ref.name }),
      ...(ref.is_active !== undefined && { is_active: ref.is_active }),
    };
  }

  return ref;
}

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
      maxlength: 160,
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
serviceMasterSchema.index({ category_id: 1, is_active: 1 });
serviceMasterSchema.index({ is_active: 1 });

serviceMasterSchema.statics.populateForList = function populateForList(query) {
  return query.populate(SERVICE_POPULATE.category);
};

serviceMasterSchema.methods.toSafeObject = function toSafeObject() {
  const category =
    this.category_id && typeof this.category_id === "object"
      ? refToSafeObject(this.category_id)
      : null;

  return {
    id: this._id,
    category_id: category?.id || this.category_id,
    category,
    name: this.name,
    duration_minutes: this.duration_minutes,
    price: this.price,
    commission_slab_override_id: this.commission_slab_override_id,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const ServiceMaster = mongoose.model("ServiceMaster", serviceMasterSchema);

export default ServiceMaster;
