import mongoose from "mongoose";

const serviceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

serviceCategorySchema.index({ name: 1 }, { unique: true });

serviceCategorySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    is_active: this.is_active,
    created_at: this.createdAt,
  };
};

const ServiceCategory = mongoose.model("ServiceCategory", serviceCategorySchema);

export default ServiceCategory;
