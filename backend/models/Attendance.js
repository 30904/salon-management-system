import mongoose from "mongoose";

export const ATTENDANCE_STATUSES = ["present", "absent", "half_day", "on_leave", "late"];

const attendanceSchema = new mongoose.Schema(
  {
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    punch_in_time: {
      type: Date,
      default: null,
    },
    punch_out_time: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "present",
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    punched_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for common attendance queries
attendanceSchema.index({ staff_id: 1, date: -1 });
attendanceSchema.index({ date: -1, status: 1 });

attendanceSchema.methods.toSafeObject = function toSafeObject() {
  const staff = this.staff_id;
  const punchedBy = this.punched_by;

  return {
    id: this._id,
    staff_id: staff?._id || this.staff_id,
    date: this.date,
    punch_in_time: this.punch_in_time,
    punch_out_time: this.punch_out_time,
    status: this.status,
    remarks: this.remarks,
    punched_by: punchedBy?._id || this.punched_by,
    staff:
      staff && typeof staff === "object" && staff._id
        ? {
            id: staff._id,
            designation: staff.designation,
            user: staff.user_id && typeof staff.user_id === "object" ? {
              id: staff.user_id._id,
              name: staff.user_id.name,
              phone: staff.user_id.phone,
            } : null,
          }
        : null,
    punched_by_user:
      punchedBy && typeof punchedBy === "object" && punchedBy._id
        ? {
            id: punchedBy._id,
            name: punchedBy.name,
            phone: punchedBy.phone,
          }
        : null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
