/**
 * Punch-in late detection: mark late after shift start + late_mark_minutes.
 * Salon local time: Asia/Kolkata.
 */
import AttendanceRule from "../models/AttendanceRule.js";
import StaffProfile from "../models/StaffProfile.js";
import ShiftMaster from "../models/ShiftMaster.js";
import User from "../models/User.js";

export const DEFAULT_LATE_MARK_MINUTES = 10;
export const SALON_TIMEZONE = "Asia/Kolkata";

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function parseHhMm(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Compare punch time vs shift start in salon timezone.
 * @returns {"present"|"late"}
 */
export function resolveAutoPunchInStatus({
  punchInDate,
  shiftStartTime,
  lateMarkMinutes = DEFAULT_LATE_MARK_MINUTES,
  timeZone = SALON_TIMEZONE,
}) {
  const shift = parseHhMm(shiftStartTime);
  if (!shift) return "present";

  const punch = getZonedParts(punchInDate, timeZone);
  const punchMinutes = punch.hour * 60 + punch.minute;
  const thresholdMinutes = shift.hour * 60 + shift.minute + Number(lateMarkMinutes || 0);

  return punchMinutes > thresholdMinutes ? "late" : "present";
}

export async function getLateMarkMinutesForBranch(branchId) {
  let rule = null;

  if (branchId) {
    rule = await AttendanceRule.findOne({
      branch_id: branchId,
      is_active: true,
    }).sort({ createdAt: -1 });
  }

  if (!rule) {
    rule = await AttendanceRule.findOne({
      branch_id: null,
      is_active: true,
    }).sort({ createdAt: -1 });
  }

  const minutes = rule?.late_mark_minutes;
  return Number.isFinite(Number(minutes)) ? Number(minutes) : DEFAULT_LATE_MARK_MINUTES;
}

/**
 * Resolve final punch-in status.
 * Explicit client status wins (manual override); otherwise auto from shift + rule.
 */
export async function resolvePunchInStatus({
  targetStaff,
  punchInDate,
  explicitStatus = null,
}) {
  if (explicitStatus) return explicitStatus;

  const staff = await StaffProfile.findById(targetStaff._id).populate(
    "shift_id",
    "name start_time end_time is_active"
  );

  const shiftDoc =
    staff?.shift_id && typeof staff.shift_id === "object"
      ? staff.shift_id
      : staff?.shift_id
        ? await ShiftMaster.findById(staff.shift_id)
        : null;

  if (!shiftDoc?.start_time || shiftDoc.is_active === false) {
    return "present";
  }

  const staffUser = await User.findById(targetStaff.user_id).select("branch_id");
  const lateMarkMinutes = await getLateMarkMinutesForBranch(staffUser?.branch_id || null);

  return resolveAutoPunchInStatus({
    punchInDate,
    shiftStartTime: shiftDoc.start_time,
    lateMarkMinutes,
  });
}
