import mongoose from "mongoose";

export const BOOKING_STATUSES = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

const bookingSchema = new mongoose.Schema(
  {
    customer_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    customer_phone: {
      type: String,
      trim: true,
      default: null,
    },
    service_label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    start_time: {
      type: Date,
      required: true,
    },
    end_time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "scheduled",
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ staff_id: 1, start_time: 1 });
bookingSchema.index({ branch_id: 1, start_time: 1 });
bookingSchema.index({ status: 1 });

bookingSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    customer_name: this.customer_name,
    customer_phone: this.customer_phone,
    service_label: this.service_label,
    staff_id: this.staff_id,
    branch_id: this.branch_id,
    start_time: this.start_time,
    end_time: this.end_time,
    status: this.status,
    notes: this.notes,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
