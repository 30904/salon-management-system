/**
 * Leave blackout / allowed-day constants — single source of truth.
 * From Leave Clash / Swap Implementation Guide (Stage 1).
 *
 * Day numbers match Date.getUTCDay():
 *   0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export const BLACKOUT_DAYS = [5, 6, 0]; // Fri, Sat, Sun — never allowed off
export const ALLOWED_DAYS = [1, 2, 3, 4]; // Mon–Thu — only allowed off window

export function isBlackoutDate(dateObj) {
  return BLACKOUT_DAYS.includes(dateObj.getUTCDay());
}
