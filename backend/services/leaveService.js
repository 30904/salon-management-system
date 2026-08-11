/**
 * Leave request workflows — Leave Clash / Swap Guide Stage 6–7.
 */
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";
import { checkClash, calculateIsPaid, normalize } from "./leaveClashService.js";
import { syncAttendanceForLeave } from "./leaveAttendanceSyncService.js";
import { swapLeave } from "./leaveSwapService.js";

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

  const clash = await checkClash({ staffId: leave.staff_id, date: leave.date });
  if (!clash.allowed) {
    throw new AppError(clash.reason, 400);
  }

  leave.status = "approved";
  leave.approved_by = approvedBy;
  await leave.save();

  await syncAttendanceForLeave(leave);

  return leave;
}

/**
 * Manager rejects a pending leave request. No Attendance write.
 */
export async function rejectLeaveRequest(leaveId) {
  const leave = await LeaveRequest.findById(leaveId);
  if (!leave) {
    throw new AppError("Leave request not found", 404);
  }
  if (leave.status !== "pending") {
    throw new AppError(`Leave request is already ${leave.status}`, 400);
  }

  leave.status = "rejected";
  await leave.save();

  return leave;
}

/**
 * Swap two approved off days and sync Attendance on both sides.
 */
export async function executeLeaveSwap({ staffIdA, dateA, staffIdB, dateB, approvedBy }) {
  const result = await swapLeave({
    staffIdA,
    dateA,
    staffIdB,
    dateB,
    approvedBy,
  });

  if (!result.success) {
    throw new AppError(result.reason, 400);
  }

  const normA = normalize(dateA);
  const normB = normalize(dateB);

  const leaveA = await LeaveRequest.findOne({
    staff_id: staffIdA,
    date: normB,
    status: "approved",
  });
  const leaveB = await LeaveRequest.findOne({
    staff_id: staffIdB,
    date: normA,
    status: "approved",
  });

  if (!leaveA || !leaveB) {
    throw new AppError("Swap completed but leave records could not be loaded.", 500);
  }

  await syncAttendanceForLeave(leaveA);
  await syncAttendanceForLeave(leaveB);

  return { leaveA, leaveB };
}

function parseMonthRange({ month, year }) {
  if (month === undefined || month === null || month === "") {
    return null;
  }

  let y;
  let m;

  if (String(month).includes("-")) {
    const [yearPart, monthPart] = String(month).split("-");
    y = parseInt(yearPart, 10);
    m = parseInt(monthPart, 10);
  } else {
    y = parseInt(year || new Date().getUTCFullYear(), 10);
    m = parseInt(month, 10);
  }

  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    throw new AppError("Invalid month query parameter. Use YYYY-MM or month with year.", 400);
  }

  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end, year: y, month: m };
}

/**
 * List leave requests for a staff member, optionally filtered by calendar month.
 */
export async function listLeaveRequests({ staffId, month, year }) {
  const filter = { staff_id: staffId };
  const range = parseMonthRange({ month, year });

  if (range) {
    filter.date = { $gte: range.start, $lte: range.end };
  }

  const rows = await LeaveRequest.find(filter).sort({ date: 1 });
  return { rows, range };
}

const STAFF_POPULATE = {
  path: "staff_id",
  select: "designation user_id",
  populate: { path: "user_id", select: "name" },
};

function formatLeaveWithStaff(leave, clash = null) {
  const staff = leave.staff_id;
  const user = staff?.user_id;
  return {
    ...leave.toSafeObject(),
    staff_name: user?.name || null,
    designation: staff?.designation || null,
    clash,
  };
}

/**
 * Manager inbox: pending leaves + designation clash context for that date.
 */
export async function listPendingLeaveRequests({ month, year } = {}) {
  const filter = { status: "pending" };
  const range = parseMonthRange({ month, year });
  if (range) {
    filter.date = { $gte: range.start, $lte: range.end };
  }

  const rows = await LeaveRequest.find(filter).populate(STAFF_POPULATE).sort({ date: 1 });
  const leaves = [];

  for (const leave of rows) {
    const staffId = leave.staff_id?._id || leave.staff_id;
    const clash = staffId
      ? await checkClash({ staffId, date: leave.date })
      : { allowed: false, reason: "Staff not found." };
    leaves.push(formatLeaveWithStaff(leave, clash));
  }

  return { leaves, range };
}
