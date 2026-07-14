import { Link, useSearchParams } from "react-router-dom";
import { BILLING_HANDOFF_PARAM } from "../../utils/billingHandoff.js";

export default function BillingInvoiceNew() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get(BILLING_HANDOFF_PARAM);

  return (
    <div className="page billing-invoice-new-page">
      <header className="page-header">
        <p className="app-eyebrow">Billing (Precious)</p>
        <h1>New invoice</h1>
        <p className="page-description">
          POS billing screen. When opened from a completed booking, the booking
          id is passed for Precious billing to pre-fill the invoice.
        </p>
      </header>

      {bookingId ? (
        <section className="status-card billing-handoff-card">
          <h2>Booking handoff</h2>
          <p>
            <strong>bookingId:</strong> {bookingId}
          </p>
          <p className="page-note">
            Precious billing reads <code>{BILLING_HANDOFF_PARAM}</code> from the
            URL and loads booking details for this invoice.
          </p>
          <Link to="/bookings" className="user-secondary-btn">
            Back to bookings
          </Link>
        </section>
      ) : (
        <p className="page-note">
          No booking handoff — open billing from a completed appointment or
          start a walk-in invoice here.
        </p>
      )}

      <Link to="/billing" className="page-link">
        Billing home
      </Link>
    </div>
  );
}
