/**
 * Salon local calendar/time helpers.
 * Booking slots and day windows must use Asia/Kolkata on every host (incl. UTC servers).
 */
export { SALON_TIMEZONE } from "../constants/discountConstants.js";
import { SALON_TIMEZONE } from "../constants/discountConstants.js";

export function getZonedParts(date, timeZone = SALON_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date instanceof Date ? date : new Date(date));

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

export function salonDateKey(date, timeZone = SALON_TIMEZONE) {
  const z = getZonedParts(date, timeZone);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

/**
 * Parse a calendar date (YYYY-MM-DD or Date) into Y/M/D in salon timezone.
 * Date-only strings are treated as salon calendar days (not UTC midnight).
 */
export function parseSalonYmd(value, timeZone = SALON_TIMEZONE) {
  if (value == null || value === "") {
    throw new Error("date is required");
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  return getZonedParts(value, timeZone);
}

/**
 * Absolute Instant for Y-M-D HH:mm:ss in salon timezone.
 */
export function zonedTimeToUtc(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone = SALON_TIMEZONE
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const got = getZonedParts(utcGuess, timeZone);
  const asUtcMs = Date.UTC(
    got.year,
    got.month - 1,
    got.day,
    got.hour,
    got.minute,
    got.second
  );
  const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcGuess.getTime() - (asUtcMs - desiredMs));
}

export function startOfSalonDay(value, timeZone = SALON_TIMEZONE) {
  const ymd = parseSalonYmd(value, timeZone);
  return zonedTimeToUtc({ ...ymd, hour: 0, minute: 0, second: 0 }, timeZone);
}

export function endOfSalonDay(value, timeZone = SALON_TIMEZONE) {
  const ymd = parseSalonYmd(value, timeZone);
  return zonedTimeToUtc({ ...ymd, hour: 23, minute: 59, second: 59 }, timeZone);
}

export function atSalonTimeOnDate(baseDate, timeString, timeZone = SALON_TIMEZONE) {
  const ymd = parseSalonYmd(baseDate, timeZone);
  const match = String(timeString || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time string: ${timeString}`);
  }

  return zonedTimeToUtc(
    {
      ...ymd,
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: 0,
    },
    timeZone
  );
}

export function isSameSalonDay(a, b, timeZone = SALON_TIMEZONE) {
  return salonDateKey(a, timeZone) === salonDateKey(b, timeZone);
}
