import mongoose from "mongoose";

const attendanceRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    late_mark_minutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    leave_types: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
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

attendanceRuleSchema.index({ branch_id: 1, name: 1 }, { unique: true });
attendanceRuleSchema.index({ is_active: 1 });

attendanceRuleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    late_mark_minutes: this.late_mark_minutes,
    leave_types: this.leave_types,
    branch_id: this.branch_id,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const AttendanceRule = mongoose.model("AttendanceRule", attendanceRuleSchema);

export default AttendanceRule;
