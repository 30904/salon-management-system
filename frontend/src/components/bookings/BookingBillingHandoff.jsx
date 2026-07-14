import { Link } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";
import { buildBillingHandoffUrl } from "../../utils/billingHandoff.js";

export default function BookingBillingHandoff({
  bookingId,
  className = "booking-billing-handoff-btn user-primary-btn",
  label = "Create Invoice",
}) {
  const { hasPermission } = usePermission();
  const canBill = hasPermission("billing", "create");

  if (!bookingId || !canBill) {
    return null;
  }

  return (
    <Link to={buildBillingHandoffUrl(bookingId)} className={className}>
      {label}
    </Link>
  );
}
