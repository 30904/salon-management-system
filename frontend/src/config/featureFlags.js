/**
 * Sheet 04 row 12 — Online booking deferred to Phase 2.
 * Prefer GET /api/bookings/feature-flags at runtime; this mirrors the env default.
 */
export const BOOKING_FEATURE_FLAGS = {
  onlineBookingEnabled: import.meta.env.VITE_ONLINE_BOOKING_ENABLED === "true",
  onlineBookingPhase: "deferred",
};
