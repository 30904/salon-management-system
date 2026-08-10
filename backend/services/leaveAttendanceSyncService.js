/**
 * Attendance sync for approved leave — Leave Clash / Swap Guide Stage 6.
 */
import Attendance from "../models/Attendance.js";
import { normalize } from "./leaveClashService.js";

/**
 * Upsert Attendance for an approved leave request.
 * Call on every approval (and after swap creates approved rows).
 */
export async function syncAttendanceForLeave(leaveRequest) {
  if (!leaveRequest || leaveRequest.status !== "approved") {
    return null;
  }

  const staffId = leaveRequest.staff_id?._id || leaveRequest.staff_id;
  const leaveDate = normalize(leaveRequest.date);
  const leaveRequestId = leaveRequest._id || leaveRequest.id;
  const remarks = leaveRequest.is_paid ? "Paid leave" : "Unpaid leave";

  return Attendance.findOneAndUpdate(
    { staff_id: staffId, date: leaveDate },
    {
      $set: {
        status: "on_leave",
        remarks,
        leave_request_id: leaveRequestId,
      },
      $setOnInsert: {
        staff_id: staffId,
        date: leaveDate,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
