import { useEffect, useState } from "react";
import { staffApi } from "../api/index.js";
import { formatTime } from "../utils/format.js";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await staffApi.getMyCalendar();
        if (!res.success) throw new Error(res.message || "Failed to load bookings");
        if (!cancelled) setBookings(res.data?.bookings || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-pad">
      <h1>My schedule</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <p className="muted">No upcoming bookings in the next two weeks.</p>
      )}

      {!loading && !error && bookings.length > 0 && (
        <ul className="booking-list">
          {bookings.map((booking) => (
            <li key={booking.id || booking._id} className="booking-card">
              <div className="booking-time">{formatTime(booking.start_time)}</div>
              <div>
                <strong>{booking.customer_name || booking.customer_id?.name || "Customer"}</strong>
                <p className="muted">{booking.service_label || "Service"}</p>
              </div>
              <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
