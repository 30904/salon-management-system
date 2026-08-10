/**
 * Leave request workflows — Leave Clash / Swap Guide Stage 6–7.
 */
import LeaveRequest from "../models/LeaveRequest.js";
import { AppError } from "../utils/AppError.js";
import { syncAttendanceForLeave } from "./leaveAttendanceSyncService.js";

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
