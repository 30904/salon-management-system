import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BookingBillingHandoff from "../../components/bookings/BookingBillingHandoff.jsx";
import { arnavApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { usePermission } from "../../hooks/usePermission.js";

const PX_PER_HOUR = 64;
const DEFAULT_DURATION_MINUTES = 30;

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

function formatHourLabel(date) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
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

function buildHourMarkers(dayStart, dayEnd) {
  const markers = [];
  const cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    markers.push(new Date(cursor));
    cursor.setHours(cursor.getHours() + 1);
  }

  return markers;
}

function buildBlockStyle(booking, dayStart, pxPerHour = PX_PER_HOUR) {
  const startMinutes =
    (new Date(booking.start_time).getTime() - dayStart.getTime()) / 60000;
  const durationMinutes =
    (new Date(booking.end_time).getTime() -
      new Date(booking.start_time).getTime()) /
    60000;

  return {
    top: (startMinutes / 60) * pxPerHour,
    height: Math.max((durationMinutes / 60) * pxPerHour, 32),
  };
}

export default function BookingCalendar() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("bookings", "create");

  const [stylists, setStylists] = useState([]);
  const [stylistId, setStylistId] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStylists() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchStaffProfiles({ is_active: "true" });

        if (!response.success) {
          throw new Error(response.message || "Failed to load stylists");
        }

        const nextStylists = response.data || [];

        if (!cancelled) {
          setStylists(nextStylists);
          if (nextStylists.length > 0) {
            setStylistId(String(nextStylists[0].id));
          }
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

    loadStylists();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      if (!stylistId || !selectedDate) {
        setBookings([]);
        setAvailability(null);
        return;
      }

      setCalendarLoading(true);
      setError(null);

      try {
        const [bookingsResponse, availabilityResponse] = await Promise.all([
          arnavApi.listBookings({
            stylist_id: stylistId,
            date: selectedDate,
            limit: 200,
          }),
          arnavApi.getBookingAvailability({
            stylist_id: stylistId,
            date: selectedDate,
            duration_minutes: DEFAULT_DURATION_MINUTES,
          }),
        ]);

        if (!bookingsResponse.success) {
          throw new Error(bookingsResponse.message || "Failed to load bookings");
        }

        if (!availabilityResponse.success) {
          throw new Error(
            availabilityResponse.message || "Failed to load availability"
          );
        }

        if (!cancelled) {
          setBookings(bookingsResponse.data || []);
          setAvailability(availabilityResponse.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setBookings([]);
          setAvailability(null);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setCalendarLoading(false);
        }
      }
    }

    loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [stylistId, selectedDate]);

  const selectedStylist = useMemo(
    () => stylists.find((stylist) => String(stylist.id) === stylistId),
    [stylists, stylistId]
  );

  const dayWindow = useMemo(() => {
    if (!availability?.working_hours?.start || !availability?.working_hours?.end) {
      return null;
    }

    return {
      start: new Date(availability.working_hours.start),
      end: new Date(availability.working_hours.end),
    };
  }, [availability]);

  const timelineMeta = useMemo(() => {
    if (!dayWindow) {
      return null;
    }

    const totalMinutes =
      (dayWindow.end.getTime() - dayWindow.start.getTime()) / 60000;

    return {
      height: (totalMinutes / 60) * PX_PER_HOUR,
      markers: buildHourMarkers(dayWindow.start, dayWindow.end),
    };
  }, [dayWindow]);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort(
        (left, right) =>
          new Date(left.start_time).getTime() -
          new Date(right.start_time).getTime()
      ),
    [bookings]
  );

  const summary = useMemo(() => {
    const active = bookings.filter((booking) =>
      ["booked", "confirmed", "in_progress"].includes(booking.status)
    ).length;

    return {
      total: bookings.length,
      active,
      freeSlots: availability?.slots?.length || 0,
    };
  }, [bookings, availability]);

  if (loading) {
    return (
      <div className="page booking-calendar-page">
        <p>Loading calendar…</p>
      </div>
    );
  }

  return (
    <div className="page booking-calendar-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Bookings</p>
          <h1>Stylist calendar</h1>
          <p className="page-description">
            Day view for one stylist — see booked blocks against working hours.
          </p>
        </div>

        <div className="booking-page-actions">
          {canCreate && (
            <Link to="/bookings/new" className="user-primary-btn">
              New booking
            </Link>
          )}
        </div>
      </header>

      <nav className="booking-view-tabs" aria-label="Booking views">
        <Link to="/bookings" className="booking-view-tab">
          Queue
        </Link>
        <Link to="/bookings/calendar" className="booking-view-tab active">
          Calendar
        </Link>
      </nav>

      {error && <p className="status-error">{error}</p>}

      <section className="user-summary-row booking-calendar-summary">
        <div className="user-summary-card">
          <span className="user-summary-label">Bookings</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Free slots</span>
          <strong>{summary.freeSlots}</strong>
        </div>
      </section>

      <div className="booking-calendar-toolbar">
        <label className="service-filter-select">
          Stylist
          <select
            value={stylistId}
            onChange={(event) => setStylistId(event.target.value)}
          >
            {stylists.map((stylist) => (
              <option key={stylist.id} value={String(stylist.id)}>
                {stylistLabel(stylist)}
              </option>
            ))}
          </select>
        </label>

        <label className="booking-date-filter">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </div>

      <section className="status-card booking-calendar-card">
        <div className="booking-calendar-card__header">
          <div>
            <h2>{formatDayHeading(selectedDate)}</h2>
            <p className="booking-calendar-card__subtitle">
              {selectedStylist ? stylistLabel(selectedStylist) : "Select stylist"}
              {dayWindow
                ? ` · ${formatHourLabel(dayWindow.start)} – ${formatHourLabel(
                    dayWindow.end
                  )}`
                : ""}
            </p>
          </div>
          <Link to="/bookings" className="user-secondary-btn">
            Open queue
          </Link>
        </div>

        {calendarLoading && <p className="booking-form-hint">Loading day view…</p>}

        {!calendarLoading && !dayWindow && (
          <p className="page-note">Select a stylist and date to load the calendar.</p>
        )}

        {!calendarLoading && dayWindow && timelineMeta && (
          <div className="booking-calendar-layout">
            <div
              className="booking-calendar-hours"
              style={{ height: `${timelineMeta.height}px` }}
            >
              {timelineMeta.markers.map((marker) => (
                <div
                  key={marker.toISOString()}
                  className="booking-calendar-hour"
                  style={{ height: `${PX_PER_HOUR}px` }}
                >
                  {formatHourLabel(marker)}
                </div>
              ))}
            </div>

            <div
              className="booking-calendar-grid"
              style={{ height: `${timelineMeta.height}px` }}
            >
              {timelineMeta.markers.map((marker) => (
                <div
                  key={`line-${marker.toISOString()}`}
                  className="booking-calendar-grid-line"
                  style={{
                    top: `${
                      ((marker.getTime() - dayWindow.start.getTime()) / 3600000) *
                      PX_PER_HOUR
                    }px`,
                  }}
                />
              ))}

              {sortedBookings.map((booking) => {
                const blockStyle = buildBlockStyle(
                  booking,
                  dayWindow.start,
                  PX_PER_HOUR
                );

                return (
                  <article
                    key={booking.id}
                    className={`booking-calendar-block ${booking.status}`}
                    style={{
                      top: `${blockStyle.top}px`,
                      height: `${blockStyle.height}px`,
                    }}
                  >
                    <div className="booking-calendar-block__time">
                      {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                    </div>
                    <strong>{booking.customer_name || "Customer"}</strong>
                    <span>{booking.service_label || "Service"}</span>
                    <span
                      className={`staff-booking-status ${booking.status}`}
                    >
                      {formatStatus(booking.status)}
                    </span>
                    {booking.status === "completed" && (
                      <BookingBillingHandoff
                        bookingId={booking.id}
                        className="booking-billing-handoff-btn booking-billing-handoff-btn--compact user-secondary-btn"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
