import mongoose from "mongoose";

/**
 * Leave request collection — Leave Clash / Swap Guide Stage 2.
 * Dates are always normalized to UTC midnight by callers/services.
 */
const leaveRequestSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    date: {
      type: Date,
      required: true, // always normalized to UTC midnight
    },
    leave_type: {
      type: String,
      enum: ["weekly_off", "extra_leave", "swapped_off"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    is_paid: {
      type: Boolean,
      default: true, // flipped by the deduction calculator, Stage 4
    },
    swap_with_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      default: null,
    },
    reason: { type: String, default: "" },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ staff_id: 1, date: 1 }, { unique: true });
leaveRequestSchema.index({ date: 1, status: 1 });

leaveRequestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    staff_id: this.staff_id?._id || this.staff_id,
    date: this.date,
    leave_type: this.leave_type,
    status: this.status,
    is_paid: this.is_paid,
    swap_with_staff_id: this.swap_with_staff_id?._id || this.swap_with_staff_id,
    reason: this.reason,
    approved_by: this.approved_by?._id || this.approved_by,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

export default LeaveRequest;
