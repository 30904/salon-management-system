/** Allowed leave days match backend leaveConstants: Mon–Thu UTC. */
export const ALLOWED_LEAVE_DAYS = [1, 2, 3, 4];

export function weekdayUtcFromIso(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isAllowedLeaveDateIso(iso) {
  return ALLOWED_LEAVE_DAYS.includes(weekdayUtcFromIso(iso));
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

export const LEAVE_TYPE_OPTIONS = [
  { value: "weekly_off", label: "Weekly off" },
  { value: "extra_leave", label: "Extra leave" },
];
