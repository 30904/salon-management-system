/**
 * Leave request workflows — Leave Clash / Swap Guide Stage 6–7.
 */
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";
import { checkClash, calculateIsPaid, normalize } from "./leaveClashService.js";
import { syncAttendanceForLeave } from "./leaveAttendanceSyncService.js";

const REQUEST_LEAVE_TYPES = ["weekly_off", "extra_leave"];

/**
 * Employee applies for leave: clash check + is_paid preview, saved as pending.
 */
export async function createLeaveRequest({
  staffId,
  date,
  leaveType = "extra_leave",
  reason = "",
}) {
  const staff = await StaffProfile.findById(staffId);
  if (!staff) {
    throw new AppError("Staff not found.", 404);
  }

  if (!REQUEST_LEAVE_TYPES.includes(leaveType)) {
    throw new AppError("Invalid leave_type.", 400);
  }

  const normDate = normalize(date);
  if (Number.isNaN(normDate.getTime())) {
    throw new AppError("Invalid date.", 400);
  }

  const clash = await checkClash({ staffId, date: normDate });
  if (!clash.allowed) {
    throw new AppError(clash.reason, 400);
  }

  const isPaid = await calculateIsPaid({ staffId, date: normDate });

  try {
    return await LeaveRequest.create({
      staff_id: staffId,
      date: normDate,
      leave_type: leaveType,
      status: "pending",
      is_paid: isPaid,
      reason,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("Leave already requested for this date.", 409);
    }
    throw error;
  }
}

/**
 * Manager approves a pending leave request and syncs Attendance.
 */
export async function approveLeaveRequest(leaveId, approvedBy) {
  const leave = await LeaveRequest.findById(leaveId);
  if (!leave) {
    throw new AppError("Leave request not found", 404);
  }
  if (leave.status !== "pending") {
    throw new AppError(`Leave request is already ${leave.status}`, 400);
  }

  leave.status = "approved";
  leave.approved_by = approvedBy;
  await leave.save();

  await syncAttendanceForLeave(leave);

  return leave;
}
