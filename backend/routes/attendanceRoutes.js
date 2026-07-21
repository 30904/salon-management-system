import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import Attendance, { ATTENDANCE_STATUSES } from "../models/Attendance.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { distanceMeters } from "../utils/geofence.js";

const router = Router();

// Protect all attendance endpoints
router.use(authenticate);

/**
 * Helper: format attendance record with populated staff and punched_by user details
 */
async function formatAttendanceResponse(doc) {
  if (!doc) return null;
  const populated = await Attendance.populate(doc, [
    {
      path: "staff_id",
      populate: { path: "user_id", select: "name phone email branch_id role_id is_active" },
    },
    {
      path: "punched_by",
      select: "name phone email role_id",
    },
  ]);
  return populated.toSafeObject();
}

/**
 * Helper: get normalized midnight UTC Date object for a given date string or Date
 */
function getNormalizedDate(dateInput) {
  const d = new Date(dateInput || Date.now());
  if (isNaN(d.getTime())) {
    throw new AppError("Invalid date format provided", 400);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Helper: resolve target StaffProfile from request (either explicit staff_id or logged-in user)
 */
async function resolveTargetStaff(req) {
  const { staff_id } = req.body || {};
  const queryStaffId = req.query?.staff_id || staff_id;

  if (queryStaffId) {
    const staff = await StaffProfile.findById(queryStaffId);
    if (!staff) {
      throw new AppError("Specified staff profile not found", 404);
    }
    return staff;
  }

  // Fallback: look up staff profile linked to logged-in user
  const staff = await StaffProfile.findOne({ user_id: req.user._id, is_active: true });
  if (!staff) {
    throw new AppError(
      "No staff profile is linked to your user account. Please provide staff_id if punching on behalf of staff.",
      404
    );
  }
  return staff;
}

function parseCoordinate(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${label} is required for attendance punch`, 400);
  }
  return parsed;
}

function isPunchingOnBehalf(req, targetStaff) {
  const actingUserId = req.user?._id?.toString();
  const staffUserId = targetStaff.user_id?.toString();
  if (!actingUserId || !staffUserId) return false;
  return actingUserId !== staffUserId;
}

async function resolveBranchForStaff(targetStaff) {
  const staffUser = await User.findById(targetStaff.user_id).populate("branch_id");
  const branch = staffUser?.branch_id;

  if (!branch) {
    throw new AppError("Staff branch is not configured for attendance punch.", 400);
  }

  if (branch.latitude == null || branch.longitude == null) {
    throw new AppError("Salon location is not configured. Please contact your administrator.", 500);
  }

  return branch;
}

async function assertWithinPunchGeofence(req, targetStaff) {
  if (isPunchingOnBehalf(req, targetStaff)) {
    return;
  }

  const latitude = parseCoordinate(req.body?.latitude, "latitude");
  const longitude = parseCoordinate(req.body?.longitude, "longitude");

  if (latitude < -90 || latitude > 90) {
    throw new AppError("latitude must be between -90 and 90", 400);
  }

  if (longitude < -180 || longitude > 180) {
    throw new AppError("longitude must be between -180 and 180", 400);
  }

  const branch = await resolveBranchForStaff(targetStaff);
  const radiusMeters = Number(branch.geofence_radius_meters || 50);
  const distance = distanceMeters(latitude, longitude, branch.latitude, branch.longitude);

  if (distance > radiusMeters) {
    throw new AppError(
      `You are outside the allowed punch area (${Math.round(distance)}m away). Please move within ${radiusMeters}m of the salon.`,
      403
    );
  }
}

/**
 * GET /api/attendance
 * List attendance records with optional filtering by staff_id, date, status, from_date, to_date
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { staff_id, date, status, from_date, to_date } = req.query;
    const filter = {};

    if (staff_id) filter.staff_id = staff_id;
    if (status) filter.status = status;

    if (date) {
      const normDate = getNormalizedDate(date);
      filter.date = normDate;
    } else if (from_date || to_date) {
      filter.date = {};
      if (from_date) filter.date.$gte = getNormalizedDate(from_date);
      if (to_date) filter.date.$lte = getNormalizedDate(to_date);
    }

    const records = await Attendance.find(filter).sort({ date: -1, punch_in_time: -1 });
    const formatted = await Promise.all(records.map((doc) => formatAttendanceResponse(doc)));

    return sendSuccess(res, {
      data: formatted,
      message: "Attendance records retrieved successfully",
    });
  })
);

/**
 * GET /api/attendance/status
 * Check if the target staff has an open punch-in today (useful for UI button state toggles)
 */
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const targetStaff = await resolveTargetStaff(req);
    const today = getNormalizedDate();

    // Check for an open punch-in (not punched out)
    const openRecord = await Attendance.findOne({
      staff_id: targetStaff._id,
      punch_in_time: { $ne: null },
      punch_out_time: null,
    }).sort({ punch_in_time: -1 });

    // Check today's summary record if any
    const todayRecord = await Attendance.findOne({
      staff_id: targetStaff._id,
      date: today,
    }).sort({ createdAt: -1 });

    const formattedOpen = await formatAttendanceResponse(openRecord);
    const formattedToday = await formatAttendanceResponse(todayRecord);

    return sendSuccess(res, {
      data: {
        staff_id: targetStaff._id,
        is_punched_in: Boolean(openRecord),
        open_record: formattedOpen,
        today_record: formattedToday,
      },
      message: "Staff attendance status retrieved successfully",
    });
  })
);

/**
 * GET /api/attendance/today
 * Staff on duty for live salon dashboard: returns all staff members with today's punch-in status and summary counts
 */
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const { branch_id } = req.query;
    const today = getNormalizedDate();

    // Fetch all active staff profiles with their user details and assigned shifts
    let allStaff = await StaffProfile.find({ is_active: true })
      .populate("user_id", "name phone email branch_id role_id is_active")
      .populate("shift_id", "name start_time end_time grace_period_minutes");

    if (branch_id) {
      allStaff = allStaff.filter(
        (s) => s.user_id && s.user_id.branch_id && s.user_id.branch_id.toString() === branch_id
      );
    }

    // Fetch today's attendance records and any currently open punch-in records
    const todayRecords = await Attendance.find({ date: today }).populate("punched_by", "name phone email");
    const openRecords = await Attendance.find({
      punch_in_time: { $ne: null },
      punch_out_time: null,
    }).populate("punched_by", "name phone email");

    const recordByStaffMap = new Map();
    for (const rec of todayRecords) {
      recordByStaffMap.set(rec.staff_id.toString(), rec);
    }
    // Open records override if not already mapped or if ongoing
    for (const rec of openRecords) {
      recordByStaffMap.set(rec.staff_id.toString(), rec);
    }

    let onDutyCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let notPunchedCount = 0;

    const staffList = allStaff.map((staff) => {
      const rec = recordByStaffMap.get(staff._id.toString()) || null;
      const isOnDuty = Boolean(rec && rec.punch_in_time && !rec.punch_out_time);
      const status = rec ? rec.status : "not_punched_in";

      if (isOnDuty) onDutyCount++;
      if (status === "present" || status === "half_day" || status === "late") presentCount++;
      else if (status === "absent" || status === "on_leave") absentCount++;
      else if (status === "not_punched_in") notPunchedCount++;

      return {
        staff_id: staff._id,
        designation: staff.designation,
        base_salary: staff.base_salary,
        user: staff.user_id
          ? {
              id: staff.user_id._id,
              name: staff.user_id.name,
              phone: staff.user_id.phone,
              email: staff.user_id.email,
            }
          : null,
        shift: staff.shift_id
          ? {
              id: staff.shift_id._id,
              name: staff.shift_id.name,
              start_time: staff.shift_id.start_time,
              end_time: staff.shift_id.end_time,
            }
          : null,
        is_on_duty: isOnDuty,
        status: status,
        attendance: rec ? rec.toSafeObject() : null,
      };
    });

    return sendSuccess(res, {
      data: {
        summary: {
          total_staff: allStaff.length,
          on_duty: onDutyCount,
          present_today: presentCount,
          absent_today: absentCount,
          not_punched_in: notPunchedCount,
          date: today.toISOString().split("T")[0],
        },
        staff_list: staffList,
      },
      message: "Today's attendance dashboard retrieved successfully",
    });
  })
);

/**
 * GET /api/attendance/summary
 * Monthly attendance summary for payroll and HR reporting
 */
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year || now.getUTCFullYear(), 10);
    const month = parseInt(req.query.month || (now.getUTCMonth() + 1), 10); // 1 to 12

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError("Invalid year or month query parameters provided", 400);
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const staffFilter = { is_active: true };
    if (req.query.staff_id) staffFilter._id = req.query.staff_id;

    let staffProfiles = await StaffProfile.find(staffFilter)
      .populate("user_id", "name phone email branch_id role_id is_active")
      .populate("shift_id", "name start_time end_time");

    if (req.query.branch_id) {
      staffProfiles = staffProfiles.filter(
        (s) => s.user_id && s.user_id.branch_id && s.user_id.branch_id.toString() === req.query.branch_id
      );
    }

    const records = await Attendance.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .sort({ date: 1, punch_in_time: 1 })
      .populate("punched_by", "name phone");

    const recordsByStaff = new Map();
    for (const rec of records) {
      const sid = rec.staff_id.toString();
      if (!recordsByStaff.has(sid)) recordsByStaff.set(sid, []);
      recordsByStaff.get(sid).push(rec);
    }

    const payrollSummaries = staffProfiles.map((staff) => {
      const staffRecords = recordsByStaff.get(staff._id.toString()) || [];
      let daysPresent = 0;
      let daysHalfDay = 0;
      let daysLate = 0;
      let daysOnLeave = 0;
      let daysAbsent = 0;
      let totalHoursWorked = 0;

      for (const rec of staffRecords) {
        if (rec.status === "present") daysPresent++;
        else if (rec.status === "half_day") daysHalfDay++;
        else if (rec.status === "late") daysLate++;
        else if (rec.status === "on_leave") daysOnLeave++;
        else if (rec.status === "absent") daysAbsent++;

        if (rec.punch_in_time && rec.punch_out_time) {
          const hours = (new Date(rec.punch_out_time) - new Date(rec.punch_in_time)) / (1000 * 60 * 60);
          if (hours > 0) totalHoursWorked += hours;
        }
      }

      // Standard payroll payable days formula: Present + Late count as 1 full day, Half day counts as 0.5
      const payableDays = Number((daysPresent + daysLate + daysHalfDay * 0.5).toFixed(2));
      totalHoursWorked = Number(totalHoursWorked.toFixed(2));

      return {
        staff_id: staff._id,
        designation: staff.designation,
        base_salary: staff.base_salary,
        user: staff.user_id
          ? {
              id: staff.user_id._id,
              name: staff.user_id.name,
              phone: staff.user_id.phone,
              email: staff.user_id.email,
            }
          : null,
        days_present: daysPresent,
        days_half_day: daysHalfDay,
        days_late: daysLate,
        days_on_leave: daysOnLeave,
        days_absent: daysAbsent,
        payable_days: payableDays,
        total_hours_worked: totalHoursWorked,
        total_punch_days: staffRecords.length,
        records: staffRecords.map((r) => r.toSafeObject()),
      };
    });

    return sendSuccess(res, {
      data: {
        month: month,
        year: year,
        total_days_in_month: totalDaysInMonth,
        payroll_summaries: payrollSummaries,
      },
      message: `Monthly attendance summary for ${month}/${year} retrieved successfully`,
    });
  })
);

/**
 * POST /api/attendance/punch-in
 * Record staff punch-in. Enforces one open punch-in per staff per day.
 * Admin/Manager punching on behalf logs punched_by = req.user._id.
 */
router.post(
  "/punch-in",
  asyncHandler(async (req, res) => {
    const { punch_time, status, remarks } = req.body;
    const targetStaff = await resolveTargetStaff(req);
    await assertWithinPunchGeofence(req, targetStaff);
    const punchInDate = punch_time ? new Date(punch_time) : new Date();
    const normalizedDate = getNormalizedDate(punchInDate);

    if (status && !ATTENDANCE_STATUSES.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${ATTENDANCE_STATUSES.join(", ")}`, 400);
    }

    // Check requirement: One open punch-in per staff per day
    const existingOpen = await Attendance.findOne({
      staff_id: targetStaff._id,
      punch_in_time: { $ne: null },
      punch_out_time: null,
    });

    if (existingOpen) {
      throw new AppError(
        "Staff member already has an open punch-in. Please punch out before recording a new punch-in.",
        400
      );
    }

    // Check if an unpunched record exists for today (e.g. pre-assigned shift or leave status)
    let attendance = await Attendance.findOne({
      staff_id: targetStaff._id,
      date: normalizedDate,
      punch_in_time: null,
    });

    if (attendance) {
      attendance.punch_in_time = punchInDate;
      if (status) attendance.status = status;
      if (remarks) attendance.remarks = remarks;
      attendance.punched_by = req.user._id; // Logs who performed this action
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        staff_id: targetStaff._id,
        date: normalizedDate,
        punch_in_time: punchInDate,
        punch_out_time: null,
        status: status || "present",
        remarks: remarks || "",
        punched_by: req.user._id, // Logs who performed this action (admin on behalf logs their user ID)
      });
    }

    const formatted = await formatAttendanceResponse(attendance);

    return sendSuccess(res, {
      status: 201,
      data: formatted,
      message: "Staff punch-in recorded successfully",
    });
  })
);

/**
 * POST /api/attendance/punch-out
 * Record staff punch-out for an active open punch-in.
 * Admin/Manager punching on behalf logs punched_by = req.user._id.
 */
router.post(
  "/punch-out",
  asyncHandler(async (req, res) => {
    const { punch_time, remarks } = req.body;
    const targetStaff = await resolveTargetStaff(req);
    await assertWithinPunchGeofence(req, targetStaff);
    const punchOutDate = punch_time ? new Date(punch_time) : new Date();

    // Find active open punch-in record
    const attendance = await Attendance.findOne({
      staff_id: targetStaff._id,
      punch_in_time: { $ne: null },
      punch_out_time: null,
    }).sort({ punch_in_time: -1 });

    if (!attendance) {
      throw new AppError("No open punch-in record found for this staff member. Cannot punch out.", 400);
    }

    if (punchOutDate < attendance.punch_in_time) {
      throw new AppError("punch_out_time cannot be earlier than punch_in_time", 400);
    }

    attendance.punch_out_time = punchOutDate;
    if (remarks) {
      attendance.remarks = attendance.remarks ? `${attendance.remarks}; ${remarks}` : remarks;
    }
    attendance.punched_by = req.user._id; // Logs who performed this action (admin on behalf updates punched_by)
    await attendance.save();

    const formatted = await formatAttendanceResponse(attendance);

    return sendSuccess(res, {
      data: formatted,
      message: "Staff punch-out recorded successfully",
    });
  })
);

/**
 * Legacy /punch route support for backwards compatibility
 */
router.post(
  "/punch",
  asyncHandler(async (req, res, next) => {
    const { action } = req.body || {};
    if (action === "punch_out") {
      return router.handle(Object.assign(req, { url: "/punch-out" }), res, next);
    }
    return router.handle(Object.assign(req, { url: "/punch-in" }), res, next);
  })
);

export default router;
