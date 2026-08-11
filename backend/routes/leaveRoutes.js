import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import StaffProfile from "../models/StaffProfile.js";
import {
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  executeLeaveSwap,
  listLeaveRequests,
  listPendingLeaveRequests,
} from "../services/leaveService.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";

const router = Router();

router.use(authenticate);

async function resolveTargetStaff(req) {
  const { staff_id: bodyStaffId } = req.body || {};
  const queryStaffId = req.query?.staff_id || bodyStaffId;

  if (queryStaffId) {
    const staff = await StaffProfile.findById(queryStaffId);
    if (!staff) {
      throw new AppError("Specified staff profile not found", 404);
    }
    return staff;
  }

  const staff = await StaffProfile.findOne({ user_id: req.user._id, is_active: true });
  if (!staff) {
    throw new AppError(
      "No staff profile is linked to your user account. Please provide staff_id.",
      404
    );
  }
  return staff;
}

/**
 * GET /api/leave?staff_id=&month=
 * List leave for staff / calendar view.
 * Manager inbox: GET /api/leave?status=pending (no staff_id) + clash context.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { month, year, status, staff_id: queryStaffId } = req.query;

    if (!queryStaffId && status === "pending") {
      const { leaves, range } = await listPendingLeaveRequests({ month, year });
      return sendSuccess(res, {
        data: {
          staff_id: null,
          month: range ? `${range.year}-${String(range.month).padStart(2, "0")}` : null,
          leaves,
        },
        message: "Pending leave requests retrieved",
      });
    }

    const staff = await resolveTargetStaff(req);

    const { rows, range } = await listLeaveRequests({
      staffId: staff._id,
      month,
      year,
    });

    return sendSuccess(res, {
      data: {
        staff_id: staff._id,
        month: range ? `${range.year}-${String(range.month).padStart(2, "0")}` : null,
        leaves: rows.map((leave) => leave.toSafeObject()),
      },
      message: "Leave records retrieved",
    });
  })
);

/**
 * POST /api/leave/request
 * Employee apply: checkClash + calculateIsPaid; save pending.
 */
router.post(
  "/request",
  asyncHandler(async (req, res) => {
    const { date, leave_type, reason } = req.body || {};
    if (!date) {
      throw new AppError("date is required", 400);
    }

    const staff = await resolveTargetStaff(req);
    const leave = await createLeaveRequest({
      staffId: staff._id,
      date,
      leaveType: leave_type || "extra_leave",
      reason: reason || "",
    });

    return sendSuccess(res, {
      status: 201,
      data: leave.toSafeObject(),
      message: "Leave request submitted",
    });
  })
);

/**
 * POST /api/leave/swap
 * Calls swapLeave(); both land approved; sync Attendance both sides.
 */
router.post(
  "/swap",
  asyncHandler(async (req, res) => {
    const { staff_id_a, date_a, staff_id_b, date_b } = req.body || {};

    if (!staff_id_a || !date_a || !staff_id_b || !date_b) {
      throw new AppError("staff_id_a, date_a, staff_id_b, and date_b are required", 400);
    }

    const { leaveA, leaveB } = await executeLeaveSwap({
      staffIdA: staff_id_a,
      dateA: date_a,
      staffIdB: staff_id_b,
      dateB: date_b,
      approvedBy: req.user._id,
    });

    return sendSuccess(res, {
      data: {
        staff_a: leaveA.toSafeObject(),
        staff_b: leaveB.toSafeObject(),
      },
      message: "Leave swap completed",
    });
  })
);

/**
 * POST /api/leave/:id/approve
 * Manager approve → approved + syncAttendanceForLeave.
 */
router.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const leave = await approveLeaveRequest(req.params.id, req.user._id);

    return sendSuccess(res, {
      data: leave.toSafeObject(),
      message: "Leave request approved",
    });
  })
);

/**
 * POST /api/leave/:id/reject
 * Manager reject → rejected; no Attendance write.
 */
router.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const leave = await rejectLeaveRequest(req.params.id);

    return sendSuccess(res, {
      data: leave.toSafeObject(),
      message: "Leave request rejected",
    });
  })
);

export default router;
