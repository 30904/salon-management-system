import { openBookingWhatsApp } from "../../utils/whatsappBooking.js";

export default function BookingWhatsAppButton({
  booking,
  className = "",
  label = "WhatsApp",
  compact = false,
}) {
  const phone = booking?.customer_phone || booking?.customer?.phone;
  if (!phone) return null;

  return (
    <button
      type="button"
      className={`booking-whatsapp-btn ${compact ? "booking-whatsapp-btn--compact" : ""} ${className}`.trim()}
      title="Open WhatsApp with booking confirmation message"
      onClick={() => openBookingWhatsApp(booking)}
    >
      {label}
    </button>
  );
}
