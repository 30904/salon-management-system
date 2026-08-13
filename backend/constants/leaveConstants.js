/**
 * Leave blackout / allowed-day constants — single source of truth.
 * From Leave Clash / Swap Implementation Guide (Stage 1).
 *
 * Day numbers match Date.getUTCDay():
 *   0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export const BLACKOUT_DAYS = [5, 6, 0]; // Fri, Sat, Sun — never allowed off
export const ALLOWED_DAYS = [1, 2, 3, 4]; // Mon–Thu — only allowed off window

/** Salary cut weight when marked absent on a blackout day (Fri/Sat/Sun). */
export const BLACKOUT_ABSENT_SALARY_CUT_DAYS = 2;

/** Every N late marks in a month = 1 unpaid salary day. */
export const LATE_MARKS_PER_UNPAID_DAY = 3;

export function isBlackoutDate(dateObj) {
  return BLACKOUT_DAYS.includes(dateObj.getUTCDay());
}

/**
 * How many unpaid salary days an absence on this date counts for payroll.
 * Fri/Sat/Sun absences count as 2; other weekdays count as 1.
 * Leave on Fri/Sat/Sun remains blocked separately via blackout.
 */
export function unpaidDaysForAbsence(dateObj) {
  return isBlackoutDate(dateObj) ? BLACKOUT_ABSENT_SALARY_CUT_DAYS : 1;
}

/**
 * Convert monthly late-mark count into unpaid salary days.
 * Example: 0–2 → 0, 3–5 → 1, 6–8 → 2.
 */
export function unpaidDaysFromLateMarks(lateCount) {
  const n = Math.max(0, Number(lateCount) || 0);
  return Math.floor(n / LATE_MARKS_PER_UNPAID_DAY);
}
