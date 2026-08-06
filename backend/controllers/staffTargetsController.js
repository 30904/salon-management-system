import { sendSuccess } from "../utils/apiResponse.js";
import {
  getMyTargets,
  upsertStaffMonthlyTarget,
} from "../services/staffTargetsService.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";

export async function getMyTargetsHandler(req, res) {
  const data = await getMyTargets(req.user._id, req.query);

  return sendSuccess(res, {
    data,
    message: "Staff monthly targets fetched",
  });
}

export async function upsertStaffTargetsHandler(req, res) {
  const profile = await StaffProfile.findById(req.params.id);
  if (!profile) {
    throw new AppError("Staff profile not found", 404);
  }

  const data = await upsertStaffMonthlyTarget(
    profile._id,
    req.body,
    req.user?._id || null
  );

  return sendSuccess(res, {
    data,
    message: "Staff monthly targets saved",
  });
}
