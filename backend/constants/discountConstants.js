export const SALON_TIMEZONE = "Asia/Kolkata";

/** Monday=1 … Sunday=7 */
export const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_LABELS = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export function parseHhMm(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute, minutes: hour * 60 + minute };
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const weekdayMap = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    weekday: weekdayMap[map.weekday] || 1,
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
  };
}

export function isDiscountAvailableAt(discount, atDate = new Date(), timeZone = SALON_TIMEZONE) {
  if (!discount || discount.is_active === false) return false;

  const days = Array.isArray(discount.days) ? discount.days.map(Number) : [];
  const start = parseHhMm(discount.start_time);
  const end = parseHhMm(discount.end_time);
  if (!start || !end || days.length === 0) return false;

  const zoned = getZonedParts(atDate, timeZone);
  if (!days.includes(zoned.weekday)) return false;

  const nowMinutes = zoned.hour * 60 + zoned.minute;

  if (start.minutes <= end.minutes) {
    return nowMinutes >= start.minutes && nowMinutes <= end.minutes;
  }

  return nowMinutes >= start.minutes || nowMinutes <= end.minutes;
}

export function allocatePercentDiscountToLines(lineItems, percentInput) {
  const percent = Number(percentInput);
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (!Number.isFinite(percent) || percent <= 0) return items;

  const capped = Math.min(100, percent);
  const eligibleIndexes = [];
  let subtotal = 0;

  items.forEach((item, index) => {
    const value = Math.max(0, Number(item.unit_price || 0) * Number(item.quantity || 1));
    if (value > 0) {
      eligibleIndexes.push(index);
      subtotal += value;
    }
  });

  if (subtotal <= 0) return items;

  const targetTotal = Number(((subtotal * capped) / 100).toFixed(2));
  let allocated = 0;
  const next = items.map((item) => ({ ...item }));

  eligibleIndexes.forEach((index, i) => {
    const item = next[index];
    const lineValue = Number(item.unit_price) * Number(item.quantity || 1);
    const share =
      i === eligibleIndexes.length - 1
        ? Number((targetTotal - allocated).toFixed(2))
        : Number(((lineValue * capped) / 100).toFixed(2));
    const amount = Math.max(0, Math.min(lineValue, share));
    item.discount_amount = amount;
    allocated += amount;
  });

  return next;
}
