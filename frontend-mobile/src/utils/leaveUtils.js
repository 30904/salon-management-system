export const ALLOWED_LEAVE_DAYS = [1, 2, 3, 4];

export function weekdayUtcFromIso(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isAllowedLeaveDateIso(iso) {
  return ALLOWED_LEAVE_DAYS.includes(weekdayUtcFromIso(iso));
}

export function isWeeklyOffDayIso(iso, weeklyOffDay = 1) {
  const offDay = Number(weeklyOffDay);
  if (!ALLOWED_LEAVE_DAYS.includes(offDay)) return false;
  return weekdayUtcFromIso(iso) === offDay;
}

export function mergeWeeklyOffIntoHistory(records = [], fromIso, toIso, weeklyOffDay = 1) {
  const byDate = new Map();
  for (const record of records) {
    const key = String(record.date || "").slice(0, 10);
    if (key) byDate.set(key, record);
  }

  const merged = [];
  const cursor = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    return records;
  }

  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    if (byDate.has(key)) {
      merged.push(byDate.get(key));
    } else if (isWeeklyOffDayIso(key, weeklyOffDay)) {
      merged.push({
        id: `weekly-off-${key}`,
        date: key,
        status: "weekly_off",
        punch_in_time: null,
        punch_out_time: null,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return merged.reverse();
}

export function isoDateKey(value) {
  return String(value || "").slice(0, 10);
}

export function monthsCoveringRange(fromIso, toIso) {
  const start = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function leaveTypeLabel(type) {
  if (type === "weekly_off") return "Weekly off";
  if (type === "extra_leave") return "Extra leave";
  if (type === "swapped_off") return "Swapped off";
  return type || "Leave";
}

export function isActiveLeave(leave) {
  return leave?.status === "pending" || leave?.status === "approved";
}

export function leavesInRange(leaves, fromIso, toIso) {
  return (leaves || []).filter((leave) => {
    const key = isoDateKey(leave.date);
    return key && key >= fromIso && key <= toIso && isActiveLeave(leave);
  });
}

export function mergeLeavesIntoHistory(records = [], leaves = []) {
  const byDate = new Map();
  for (const record of records) {
    const key = isoDateKey(record.date);
    if (key) byDate.set(key, record);
  }

  for (const leave of leaves) {
    if (!isActiveLeave(leave)) continue;
    const key = isoDateKey(leave.date);
    if (!key) continue;

    const existing = byDate.get(key);
    const leaveMeta = {
      leave_id: leave.id || leave._id,
      leave_status: leave.status,
      leave_type: leave.leave_type,
      is_paid: leave.is_paid,
      reason: leave.reason || "",
    };

    if (!existing || existing.status === "weekly_off") {
      byDate.set(key, {
        id: leaveMeta.leave_id || `leave-${key}`,
        date: key,
        status: leave.status === "approved" ? "on_leave" : "leave_pending",
        punch_in_time: null,
        punch_out_time: null,
        remarks: leave.reason || "",
        ...leaveMeta,
      });
    } else {
      byDate.set(key, {
        ...existing,
        ...leaveMeta,
        status: leave.status === "approved" ? existing.status || "on_leave" : existing.status,
        remarks: existing.remarks || leave.reason || "",
      });
    }
  }

  return [...byDate.values()].sort((a, b) => isoDateKey(b.date).localeCompare(isoDateKey(a.date)));
}

export function defaultLeaveDateIso() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = 0; i < 7; i += 1) {
    const dt = new Date(start + i * 24 * 60 * 60 * 1000);
    if (ALLOWED_LEAVE_DAYS.includes(dt.getUTCDay())) {
      return dt.toISOString().slice(0, 10);
    }
  }
  return now.toISOString().slice(0, 10);
}
