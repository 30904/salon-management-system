/**
 * Leave clash helpers — Leave Clash / Swap Guide Stage 3.
 */
import LeaveRequest from "../models/LeaveRequest.js";
import StaffProfile from "../models/StaffProfile.js";
import { isBlackoutDate } from "../constants/leaveConstants.js";

/**
 * Normalize a Date to UTC midnight for leave date comparisons.
 */
export function normalize(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Checks whether staffId can be off on `date`.
 * Returns { allowed: true } or { allowed: false, reason }
 */
export async function checkClash({ staffId, date, excludeStaffId = null }) {
  const normalizedDate = normalize(date);

  // --- Check 1: blackout window (Fri/Sat/Sun) ---
  if (isBlackoutDate(normalizedDate)) {
    return { allowed: false, reason: "Leave cannot be taken on Friday, Saturday or Sunday." };
  }

  // --- Check 2: designation clash ---
  const staff = await StaffProfile.findById(staffId);
  if (!staff) return { allowed: false, reason: "Staff not found." };

  const sameDesignationStaff = await StaffProfile.find({
    designation: staff.designation,
    _id: { $ne: staffId },
  }).select("_id");

  const sameDesignationIds = sameDesignationStaff
    .map((s) => s._id)
    .filter((id) => !excludeStaffId || String(id) !== String(excludeStaffId));

  const existingClash = await LeaveRequest.findOne({
    staff_id: { $in: sameDesignationIds },
    date: normalizedDate,
    status: "approved",
  });

  if (existingClash) {
    return {
      allowed: false,
      reason: `Another ${staff.designation} is already off on this date.`,
    };
  }

  return { allowed: true };
}
