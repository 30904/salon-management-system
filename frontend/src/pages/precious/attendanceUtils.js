export function getStaffUser(staff, summaryUser = null) {
  if (staff?.user?.name) return staff.user;
  if (summaryUser?.name) return summaryUser;
  return staff?.user || summaryUser || null;
}

export function getStaffDisplayName(staff, summaryUser = null) {
  const user = getStaffUser(staff, summaryUser);
  if (user?.name) return user.name;
  if (staff?.designation) return staff.designation;
  return "Unnamed staff";
}

export function getEmployeeCode(staff) {
  const rawId = String(staff?.id || staff?._id || "");
  if (rawId.length >= 4) {
    return `E${rawId.slice(-4).toUpperCase()}`;
  }
  const phone = staff?.user?.phone || "";
  if (phone.length >= 4) {
    return `E${phone.slice(-4)}`;
  }
  return "—";
}

export function getStaffShift(staff) {
  if (staff?.shift?.name || staff?.shift?.start_time) {
    return staff.shift;
  }
  const shift = staff?.shift_id;
  if (shift && typeof shift === "object" && (shift.name || shift.start_time)) {
    return shift;
  }
  return null;
}

export function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export function formatShiftClock(time24) {
  if (!time24) return "—";
  const mins = parseTimeToMinutes(time24);
  if (mins == null) return time24;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${period}`;
}

export function formatShiftRange(shift) {
  if (!shift?.start_time || !shift?.end_time) return "General Shift";
  return `${formatShiftClock(shift.start_time)} - ${formatShiftClock(shift.end_time)}`;
}

export function getExpectedHours(shift) {
  if (!shift?.start_time || !shift?.end_time) return null;
  const startMin = parseTimeToMinutes(shift.start_time);
  const endMin = parseTimeToMinutes(shift.end_time);
  if (startMin == null || endMin == null) return null;
  const diff = endMin - startMin;
  return diff >= 0 ? Number((diff / 60).toFixed(2)) : null;
}

export function isWeeklyOffDay(dateObj) {
  return dateObj.getUTCDay() === 0;
}

export function resolveDayStatus({ record, dateObj }) {
  if (record?.status) return record.status;
  if (isWeeklyOffDay(dateObj)) return "weekly_off";
  return "absent";
}

export function statusLabel(status) {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "half_day":
      return "Half Day";
    case "on_leave":
      return "On Leave";
    case "weekly_off":
      return "Weekly Off";
    case "not_punched_in":
      return "Pending";
    case "absent":
    default:
      return "Absent";
  }
}

export function statusClass(status) {
  switch (status) {
    case "present":
      return "attendance-status-present";
    case "late":
      return "attendance-status-late";
    case "half_day":
      return "attendance-status-half_day";
    case "on_leave":
      return "attendance-status-on_leave";
    case "weekly_off":
      return "attendance-status-weekly_off";
    case "not_punched_in":
      return "attendance-status-pending";
    case "absent":
    default:
      return "attendance-status-absent";
  }
}

export function enrichStaffProfiles(staffProfiles = [], users = []) {
  const userMap = new Map(
    users.map((user) => [String(user.id || user._id), user])
  );

  return staffProfiles.map((staff) => {
    const populatedUserDoc =
      staff.user_id && typeof staff.user_id === "object" && staff.user_id.name
        ? {
            id: staff.user_id._id || staff.user_id.id,
            name: staff.user_id.name,
            phone: staff.user_id.phone,
            email: staff.user_id.email,
            branch_id: staff.user_id.branch_id,
            branch: staff.user_id.branch_id?.name ? { name: staff.user_id.branch_id.name } : staff.user?.branch || null,
          }
        : null;

    const userId = String(
      populatedUserDoc?.id || staff.user_id || staff.user?.id || ""
    );

    const linkedUser = staff.user?.name
      ? staff.user
      : populatedUserDoc?.name
        ? populatedUserDoc
        : userMap.get(userId) || staff.user || null;

    const shift = getStaffShift(staff);

    return {
      ...staff,
      user: linkedUser,
      shift,
    };
  });
}
