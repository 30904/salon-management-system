/**
 * Build a WhatsApp deep-link so staff can open the customer's chat
 * with a prefilled booking confirmation and tap Send manually.
 */

export function normalizeWhatsAppPhone(phone) {
  if (!phone) return null;

  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;

  // Already has country code (India 12 digits starting with 91)
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  // 10-digit Indian mobile
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Leading 0 + 10 digits
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  // Fallback: use as-is if long enough
  if (digits.length >= 10) {
    return digits;
  }

  return null;
}

function formatBookingDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBookingTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildBookingConfirmationMessage(booking = {}) {
  const name = booking.customer_name || booking.customer?.name || "Customer";
  const date = formatBookingDate(booking.start_time || booking.booking_date);
  const start = formatBookingTime(booking.start_time);
  const end = formatBookingTime(booking.end_time);
  const service = booking.service_label || booking.services?.[0]?.name || "Service";
  const stylist =
    booking.staff_name ||
    booking.stylist?.user?.name ||
    booking.stylist?.designation ||
    "our stylist";

  const timePart =
    start && end ? `${start} – ${end}` : start || "the scheduled time";

  return [
    `Hello ${name},`,
    ``,
    `Your appointment at S21 Family Salon is confirmed.`,
    `Date: ${date || "—"}`,
    `Time: ${timePart}`,
    `Service: ${service}`,
    `Stylist: ${stylist}`,
    ``,
    `We look forward to seeing you!`,
  ].join("\n");
}

export function buildBookingWhatsAppUrl(booking) {
  const phone = normalizeWhatsAppPhone(
    booking?.customer_phone || booking?.customer?.phone
  );
  if (!phone) return null;

  const text = buildBookingConfirmationMessage(booking);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function openBookingWhatsApp(booking) {
  const url = buildBookingWhatsAppUrl(booking);
  if (!url) {
    window.alert("This booking has no valid customer phone number for WhatsApp.");
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
