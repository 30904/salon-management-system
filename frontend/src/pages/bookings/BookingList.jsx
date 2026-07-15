import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BookingBillingHandoff from "../../components/bookings/BookingBillingHandoff.jsx";
import { arnavApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { usePermission } from "../../hooks/usePermission.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "booked", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No show" },
  { key: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = ["booked", "confirmed", "in_progress"];

const QUICK_ACTIONS = {
  booked: [
    { status: "confirmed", label: "Confirm" },
    { status: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { status: "in_progress", label: "Start" },
    { status: "no_show", label: "No show" },
    { status: "cancelled", label: "Cancel" },
  ],
  in_progress: [
    { status: "completed", label: "Complete" },
    { status: "cancelled", label: "Cancel" },
  ],
};

function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatDayHeading(value) {
  const date = new Date(`${value}T00:00:00`);
  const today = toDateInputValue();

  if (value === today) {
    return "Today";
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  if (status === "in_progress") return "In progress";
  if (status === "no_show") return "No show";
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function stylistLabel(stylist) {
  return stylist?.user?.name || stylist?.designation || "Stylist";
}

export default function BookingList() {
  const location = useLocation();
  const { hasPermission } = usePermission();
  const [bookings, setBookings] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [stylistFilter, setStylistFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [updatingId, setUpdatingId] = useState(null);

  const canEdit = hasPermission("bookings", "edit");
  const canCreate = hasPermission("bookings", "create");
  const [banner, setBanner] = useState(location.state?.success || null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        date: selectedDate,
        limit: 200,
      };

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      if (stylistFilter !== "all") {
        params.stylist_id = stylistFilter;
      }

      const response = await arnavApi.listBookings(params);

      if (!response.success) {
        throw new Error(response.message || "Failed to load bookings");
      }

      setBookings(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, stylistFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadStylists() {
      try {
        const response = await fetchStaffProfiles({ is_active: "true" });

        if (!cancelled && response.success) {
          setStylists(response.data || []);
        }
      } catch {
        if (!cancelled) {
          setStylists([]);
        }
      }
    }

    loadStylists();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const summary = useMemo(() => {
    const active = bookings.filter((booking) =>
      ACTIVE_STATUSES.includes(booking.status)
    ).length;
    const completed = bookings.filter(
      (booking) => booking.status === "completed"
    ).length;
    const closed = bookings.filter((booking) =>
      ["cancelled", "no_show"].includes(booking.status)
    ).length;

    return {
      total: bookings.length,
      active,
      completed,
      closed,
    };
  }, [bookings]);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((left, right) => {
      const rightStamp = new Date(
        right.updated_at || right.created_at || right.start_time
      ).getTime();
      const leftStamp = new Date(
        left.updated_at || left.created_at || left.start_time
      ).getTime();

      return rightStamp - leftStamp;
    });
  }, [bookings]);

  async function handleStatusUpdate(bookingId, status) {
    setUpdatingId(bookingId);
    setError(null);

    try {
      const response = await arnavApi.updateBookingStatus(bookingId, status);

      if (!response.success) {
        throw new Error(response.message || "Failed to update booking status");
      }

      const updated = response.data;

      setBookings((current) => {
        if (statusFilter !== "all" && updated.status !== statusFilter) {
          return current.filter((booking) => booking.id !== bookingId);
        }

        return current.map((booking) =>
          booking.id === bookingId ? updated : booking
        );
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page booking-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Bookings</p>
          <h1>{formatDayHeading(selectedDate)} queue</h1>
          <p className="page-description">
            Reception desk view of today&apos;s appointments. Filter by status or
            stylist and advance bookings through the day.
          </p>
        </div>

        <div className="booking-page-actions">
          {canCreate && (
            <Link to="/bookings/new" className="user-primary-btn">
              New booking
            </Link>
          )}

          <label className="booking-date-filter">
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
      </header>

      <nav className="booking-view-tabs" aria-label="Booking views">
        <Link to="/bookings" className="booking-view-tab active">
          Queue
        </Link>
        <Link to="/bookings/calendar" className="booking-view-tab">
          Calendar
        </Link>
      </nav>

      {banner && <p className="user-success-text">{banner}</p>}
      {error && <p className="status-error">{error}</p>}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Shown</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Completed</span>
          <strong>{summary.completed}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Closed</span>
          <strong>{summary.closed}</strong>
        </div>
      </section>

      <div className="booking-filter-bar">
        <label className="service-filter-select">
          Stylist
          <select
            value={stylistFilter}
            onChange={(event) => setStylistFilter(event.target.value)}
          >
            <option value="all">All stylists</option>
            {stylists.map((stylist) => (
              <option key={stylist.id} value={String(stylist.id)}>
                {stylistLabel(stylist)}
              </option>
            ))}
          </select>
        </label>

        <div className="user-filter-row">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`user-filter-btn ${
                statusFilter === filter.key ? "active" : ""
              }`}
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="status-card booking-queue-card">
        {loading && <p>Loading bookings…</p>}

        {!loading && !error && sortedBookings.length === 0 && (
          <p className="page-note">No bookings found for this day and filter.</p>
        )}

        {!loading && sortedBookings.length > 0 && (
          <div className="booking-queue-list">
            {sortedBookings.map((booking) => {
              const showStatusActions =
                canEdit &&
                statusFilter !== "all" &&
                statusFilter === booking.status &&
                (QUICK_ACTIONS[booking.status] || []).length > 0;
              const actions = showStatusActions
                ? QUICK_ACTIONS[booking.status]
                : [];
              const showInvoice =
                statusFilter === "completed" && booking.status === "completed";

              return (
                <article key={booking.id} className="staff-booking-card booking-queue-item">
                  <div className="staff-booking-time">
                    <strong>{formatTime(booking.start_time)}</strong>
                    <span>{formatTime(booking.end_time)}</span>
                  </div>

                  <div className="staff-booking-details">
                    <div className="staff-booking-title-row">
                      <h3>{booking.customer_name || "Customer"}</h3>
                      <span
                        className={`staff-booking-status ${booking.status}`}
                      >
                        {formatStatus(booking.status)}
                      </span>
                    </div>

                    <p>
                      <strong>{booking.service_label || "Service"}</strong>
                      {" · "}
                      {booking.staff_name || stylistLabel(booking.stylist)}
                    </p>

                    {booking.customer_phone && (
                      <p className="booking-queue-phone">{booking.customer_phone}</p>
                    )}

                    {booking.notes && (
                      <p className="page-note">{booking.notes}</p>
                    )}

                    {showStatusActions && (
                      <div className="booking-queue-actions">
                        {actions.map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            className={`booking-queue-action ${
                              action.status === "cancelled" ||
                              action.status === "no_show"
                                ? "danger"
                                : ""
                            }`}
                            disabled={updatingId === booking.id}
                            onClick={() =>
                              handleStatusUpdate(booking.id, action.status)
                            }
                          >
                            {updatingId === booking.id
                              ? "Saving…"
                              : action.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {showInvoice && (
                      <div className="booking-queue-handoff">
                        <BookingBillingHandoff bookingId={booking.id} />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
