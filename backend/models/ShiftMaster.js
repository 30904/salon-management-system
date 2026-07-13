import mongoose from "mongoose";

const shiftMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    start_time: {
      type: String,
      required: true,
      trim: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // e.g. "09:00" or "18:30"
    },
    end_time: {
      type: String,
      required: true,
      trim: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // e.g. "17:00" or "20:00"
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

shiftMasterSchema.index({ branch_id: 1, name: 1 }, { unique: true });
shiftMasterSchema.index({ is_active: 1 });

shiftMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    start_time: this.start_time,
    end_time: this.end_time,
    branch_id: this.branch_id,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const ShiftMaster = mongoose.model("ShiftMaster", shiftMasterSchema);

export default ShiftMaster;
