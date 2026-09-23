/**
 * Normalize phone to WhatsApp Cloud API digits (e.g. 9198XXXXXXXX).
 */
export function normalizeWhatsAppPhone(phone) {
  if (!phone) return null;

  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  if (digits.length >= 10) {
    return digits;
  }

  return null;
}
