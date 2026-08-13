/**
 * Monthly attendance summary — shared by GET /api/attendance/summary
 * and payrollService (Payroll Patch Guide Stage B).
 */
import Attendance from "../models/Attendance.js";
import Holiday from "../models/Holiday.js";
import StaffProfile from "../models/StaffProfile.js";
import { unpaidDaysForAbsence, unpaidDaysFromLateMarks } from "../constants/leaveConstants.js";

function utcMidnightKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Build payroll-oriented attendance summaries for a calendar month.
 *
 * @param {{ year: number, month: number, staffId?: string|null, branchId?: string|null }} opts
 * @returns {Promise<{
 *   month: number,
 *   year: number,
 *   total_days_in_month: number,
 *   payroll_summaries: object[]
 * }>}
 */
export async function getMonthlyAttendanceSummary({
  year,
  month,
  staffId = null,
  branchId = null,
}) {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const staffFilter = { is_active: true };
  if (staffId) staffFilter._id = staffId;

  let staffProfiles = await StaffProfile.find(staffFilter)
    .populate("user_id", "name phone email branch_id role_id is_active")
    .populate("shift_id", "name start_time end_time");

  if (branchId) {
    staffProfiles = staffProfiles.filter(
      (s) =>
        s.user_id &&
        s.user_id.branch_id &&
        s.user_id.branch_id.toString() === String(branchId)
    );
  }

  const holidays = await Holiday.find({
    is_active: true,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  }).select("date branch_id");

  const attendanceFilter = {
    date: { $gte: startOfMonth, $lte: endOfMonth },
  };
  if (staffId) {
    attendanceFilter.staff_id = staffId;
  }

  const records = await Attendance.find(attendanceFilter)
    .sort({ date: 1, punch_in_time: 1 })
    .populate("punched_by", "name phone")
    .populate("leave_request_id", "is_paid leave_type status date");

  const recordsByStaff = new Map();
  for (const rec of records) {
    const sid = rec.staff_id.toString();
    if (!recordsByStaff.has(sid)) recordsByStaff.set(sid, []);
    recordsByStaff.get(sid).push(rec);
  }

  const payrollSummaries = staffProfiles.map((staff) => {
    const staffBranchId = staff.user_id?.branch_id
      ? String(staff.user_id.branch_id)
      : null;

    // Company-wide (branch_id null) + this staff's branch holidays
    const holidayKeys = new Set();
    for (const h of holidays) {
      const hBranch = h.branch_id ? String(h.branch_id) : null;
      if (hBranch === null || (staffBranchId && hBranch === staffBranchId)) {
        holidayKeys.add(utcMidnightKey(h.date));
      }
    }

    const staffRecords = recordsByStaff.get(staff._id.toString()) || [];
    let daysPresent = 0;
    let daysHalfDay = 0;
    let daysLate = 0;
    let daysOnLeave = 0;
    let daysPaidLeave = 0;
    let daysUnpaidLeave = 0;
    let daysAbsent = 0;
    let unpaidAbsentDays = 0;
    let totalHoursWorked = 0;

    for (const rec of staffRecords) {
      // Holiday dates are paid skips — do not count present / leave / absent
      if (holidayKeys.has(utcMidnightKey(rec.date))) {
        continue;
      }

      if (rec.status === "present") daysPresent++;
      else if (rec.status === "half_day") daysHalfDay++;
      else if (rec.status === "late") daysLate++;
      else if (rec.status === "on_leave") {
        daysOnLeave++;
        const leaveRef = rec.leave_request_id;
        const isPaid =
          leaveRef && typeof leaveRef === "object"
            ? leaveRef.is_paid === true
            : false;
        if (isPaid) daysPaidLeave++;
        else daysUnpaidLeave++;
      } else if (rec.status === "absent") {
        daysAbsent++;
        // Fri/Sat/Sun no-show = 2 salary days; other absences = 1
        unpaidAbsentDays += unpaidDaysForAbsence(rec.date);
      }

      if (rec.punch_in_time && rec.punch_out_time) {
        const hours =
          (new Date(rec.punch_out_time) - new Date(rec.punch_in_time)) /
          (1000 * 60 * 60);
        if (hours > 0) totalHoursWorked += hours;
      }
    }

    // payableDays = present + late + half_day*0.5 + daysPaidLeave + holidayCount
    // unpaidDays = unpaidLeave + weighted absences (Fri/Sat/Sun absent = 2)
    //            + floor(lateMarks / 3)  →  3 late marks = 1 day salary cut
    const holidayCount = holidayKeys.size;
    const latePenaltyDays = unpaidDaysFromLateMarks(daysLate);
    const payableDays = Number(
      (
        daysPresent +
        daysLate +
        daysHalfDay * 0.5 +
        daysPaidLeave +
        holidayCount
      ).toFixed(2)
    );
    const unpaidDays = Number(
      (daysUnpaidLeave + unpaidAbsentDays + latePenaltyDays).toFixed(2)
    );
    const workingDaysInMonth = totalDaysInMonth - holidayCount;
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
      days_paid_leave: daysPaidLeave,
      days_unpaid_leave: daysUnpaidLeave,
      days_absent: daysAbsent,
      late_penalty_days: latePenaltyDays,
      holiday_count: holidayCount,
      working_days_in_month: workingDaysInMonth,
      payable_days: payableDays,
      unpaid_days: unpaidDays,
      total_hours_worked: totalHoursWorked,
      total_punch_days: staffRecords.length,
      records: staffRecords.map((r) => r.toSafeObject()),
    };
  });

  return {
    month,
    year,
    total_days_in_month: totalDaysInMonth,
    payroll_summaries: payrollSummaries,
  };
}
