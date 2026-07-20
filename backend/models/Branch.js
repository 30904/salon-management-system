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
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    geofence_radius_meters: {
      type: Number,
      min: 1,
      default: 50,
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
    latitude: this.latitude,
    longitude: this.longitude,
    geofence_radius_meters: this.geofence_radius_meters,
    is_active: this.is_active,
    created_at: this.createdAt,
  };
};

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
