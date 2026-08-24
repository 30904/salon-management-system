import mongoose from "mongoose";
import { WEEKDAY_VALUES } from "../constants/discountConstants.js";

const discountMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    days: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((day) => WEEKDAY_VALUES.includes(Number(day)))
          );
        },
        message: "days must include at least one weekday from 1 (Monday) to 7 (Sunday)",
      },
    },
    start_time: {
      type: String,
      required: true,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "start_time must be HH:mm"],
    },
    end_time: {
      type: String,
      required: true,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "end_time must be HH:mm"],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

discountMasterSchema.index({ name: 1 }, { unique: true });
discountMasterSchema.index({ is_active: 1 });

discountMasterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    percent: this.percent,
    days: this.days,
    start_time: this.start_time,
    end_time: this.end_time,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const DiscountMaster = mongoose.model("DiscountMaster", discountMasterSchema);

export default DiscountMaster;
