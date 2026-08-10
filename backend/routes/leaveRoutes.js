import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import StaffProfile from "../models/StaffProfile.js";
import { createLeaveRequest } from "../services/leaveService.js";
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
 * Leave Clash / Swap Guide Stage 7 — remaining endpoints in tracker rows 32–35.
 *   POST /:id/approve    — manager approve + sync attendance
 *   POST /:id/reject     — manager reject
 *   POST /swap           — swap two staff off days
 *   GET  /               — list leave by staff_id / month
 */

export default router;
