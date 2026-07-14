/**
 * Sheet 04 row 12 — Online booking is Phase 2 (deferred).
 * Same slot engine will apply with source=online when enabled.
 */
export function isOnlineBookingEnabled() {
  return process.env.ONLINE_BOOKING_ENABLED === "true";
}

export function getBookingFeatureFlags() {
  return {
    online_booking_enabled: isOnlineBookingEnabled(),
    online_booking_phase: "deferred",
    online_booking_note:
      "Customer self-booking web flow is Phase 2. Phase 1 uses internal front-desk bookings only.",
    allowed_booking_sources: isOnlineBookingEnabled()
      ? ["internal", "online"]
      : ["internal"],
  };
}
