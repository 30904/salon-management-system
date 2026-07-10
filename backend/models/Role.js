import mongoose from "mongoose";

export const ROLE_NAMES = {
  OWNER: "Owner/CEO",
  MANAGER: "Manager",
  STYLIST: "Stylist",
  MASSAGE_THERAPIST: "Massage/Spa Therapist",
};

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: Object.values(ROLE_NAMES),
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

roleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    created_at: this.createdAt,
  };
};

const Role = mongoose.model("Role", roleSchema);

export default Role;
