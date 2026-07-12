import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

const RANGE_OPTIONS = [
  { value: 7, label: "Next 7 days" },
  { value: 14, label: "Next 14 days" },
  { value: 30, label: "Next 30 days" },
];

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function buildRange(days) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + days);

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
}

function formatDay(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  return String(status || "scheduled").replace(/_/g, " ");
}

function groupBookingsByDay(bookings) {
  return bookings.reduce((groups, booking) => {
    const key = toDateInputValue(new Date(booking.start_time));
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(booking);
    return groups;
  }, {});
}

export default function MyCalendar() {
  const { user } = usePermission();
  const [rangeDays, setRangeDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => buildRange(rangeDays), [rangeDays]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setLoading(true);
      setError(null);

      try {
        const response = await arnavApi.getMyCalendar(range);

        if (!response.success) {
          throw new Error(response.message || "Failed to load calendar");
        }

        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const bookings = data?.bookings || [];
  const groupedBookings = useMemo(
    () => groupBookingsByDay(bookings),
    [bookings]
  );
  const dayKeys = Object.keys(groupedBookings).sort();
  const summary = data?.summary;
  const staff = data?.staff;

  return (
    <div className="page my-calendar-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Staff Portal</p>
          <h1>My calendar</h1>
          <p className="page-description">
            Read-only view of bookings assigned to{" "}
            <strong>{user?.name || "your account"}</strong>.
          </p>
        </div>

        <label className="staff-calendar-filter">
          Range
          <select
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value))}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && <p>Loading calendar...</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && !staff && (
        <section className="status-card">
          <h2>No staff profile linked</h2>
          <p className="page-note">
            Your login is active, but no StaffProfile is linked yet. Ask your
            manager to link your user account in Staff Master.
          </p>
        </section>
      )}

      {!loading && !error && staff && (
        <>
          <section className="user-summary-row">
            <div className="user-summary-card">
              <span className="user-summary-label">Bookings</span>
              <strong>{summary?.total || 0}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Upcoming</span>
              <strong>{summary?.upcoming || 0}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Completed</span>
              <strong>{summary?.completed || 0}</strong>
            </div>
          </section>

          <section className="status-card staff-calendar-card">
            {bookings.length === 0 ? (
              <p className="page-note">No bookings assigned in this range.</p>
            ) : (
              <div className="staff-calendar-days">
                {dayKeys.map((dayKey) => (
                  <section key={dayKey} className="staff-calendar-day">
                    <h2>{formatDay(dayKey)}</h2>
                    <div className="staff-calendar-bookings">
                      {groupedBookings[dayKey].map((booking) => (
                        <article key={booking.id} className="staff-booking-card">
                          <div className="staff-booking-time">
                            <strong>{formatTime(booking.start_time)}</strong>
                            <span>{formatTime(booking.end_time)}</span>
                          </div>
                          <div className="staff-booking-details">
                            <div className="staff-booking-title-row">
                              <h3>{booking.service_label}</h3>
                              <span
                                className={`staff-booking-status ${booking.status}`}
                              >
                                {formatStatus(booking.status)}
                              </span>
                            </div>
                            <p>
                              <strong>{booking.customer_name}</strong>
                              {booking.customer_phone
                                ? ` - ${booking.customer_phone}`
                                : ""}
                            </p>
                            {booking.notes && (
                              <p className="page-note">{booking.notes}</p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
