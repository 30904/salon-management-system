import mongoose from "mongoose";

const serviceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

serviceCategorySchema.index({ name: 1 }, { unique: true });
serviceCategorySchema.index({ is_active: 1 });

serviceCategorySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const ServiceCategory = mongoose.model("ServiceCategory", serviceCategorySchema);

export default ServiceCategory;
