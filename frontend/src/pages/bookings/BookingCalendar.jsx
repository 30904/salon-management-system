import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BookingBillingHandoff from "../../components/bookings/BookingBillingHandoff.jsx";
import { arnavApi, preciousApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { usePermission } from "../../hooks/usePermission.js";

const AXIS_START_MIN = 10 * 60;
const AXIS_END_MIN = 22 * 60;
const AXIS_LATEST_MIN = 24 * 60;
const PX_PER_HOUR = 108;
const LANE_HEIGHT = 54;
const STAFF_CHOICE_KEY = "s21.calendar.staffIds";

function toDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDayHeading(value) {
  const date = new Date(`${value}T00:00:00`);
  if (value === toDateInputValue()) return "Today";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
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

function isSalonOwner(stylist) {
  const name = stylist?.user?.name || "";
  const designation = stylist?.designation || "";
  return /owner|ceo/i.test(name) || /owner|ceo/i.test(designation);
}

function kolkataMinutes(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

function formatAxisHour(minutes) {
  const hour = Math.floor(minutes / 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  const label = hour % 12 || 12;
  return `${label} ${suffix}`;
}

function clockFromMinutes(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function readSavedStaffIds() {
  try {
    const raw = localStorage.getItem(STAFF_CHOICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function punchBar(record, selectedDate, axisEnd) {
  if (!record?.punch_in_time) return null;
  const start = Math.max(kolkataMinutes(record.punch_in_time), AXIS_START_MIN);
  let end = record.punch_out_time ? kolkataMinutes(record.punch_out_time) : null;
  if (end == null) {
    const today = toDateInputValue();
    if (selectedDate === today) end = kolkataMinutes(new Date());
    else if (selectedDate < today) end = AXIS_END_MIN;
    else return null;
  }
  end = Math.min(end, axisEnd);
  if (end - start < 10) return null;
  return { start, end };
}

function axisEndFor(selectedDate, now) {
  if (selectedDate !== toDateInputValue(now)) return AXIS_END_MIN;
  const current = kolkataMinutes(now);
  if (current <= AXIS_END_MIN) return AXIS_END_MIN;
  const nextHour = Math.ceil(current / 60) * 60;
  return Math.min(Math.max(nextHour, AXIS_END_MIN), AXIS_LATEST_MIN);
}

function ownerBar(selectedDate, now, axisEnd) {
  const today = toDateInputValue(now);
  if (selectedDate !== today) {
    return { start: AXIS_START_MIN, end: AXIS_END_MIN, clickEnd: AXIS_END_MIN };
  }
  const current = Math.min(kolkataMinutes(now), axisEnd);
  return {
    start: AXIS_START_MIN,
    end: Math.max(current, AXIS_START_MIN),
    clickEnd: axisEnd,
  };
}

function assignLanes(bookings) {
  const sorted = [...bookings].sort(
    (left, right) => new Date(left.start_time) - new Date(right.start_time)
  );
  const laneEnds = [];
  return sorted.map((booking) => {
    const start = kolkataMinutes(booking.start_time);
    const end = Math.max(kolkataMinutes(booking.end_time), start + 15);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { booking, lane, start, end };
  });
}

function hourMarks(axisEnd) {
  const marks = [];
  for (let minute = AXIS_START_MIN; minute <= axisEnd; minute += 60) marks.push(minute);
  return marks;
}

export default function BookingCalendar() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("bookings", "create");

  const [stylists, setStylists] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [bookings, setBookings] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [savedIds, setSavedIds] = useState(readSavedStaffIds);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [openBooking, setOpenBooking] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
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
        if (!cancelled) setStylists(response.data || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStylists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDirty(false);
    setOpenBooking(null);
  }, [selectedDate]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      if (!selectedDate) return;
      setBoardLoading(true);
      setError(null);
      try {
        const [bookingsResponse, attendanceResponse] = await Promise.all([
          arnavApi.listBookings({ date: selectedDate, limit: 500 }),
          preciousApi.getAttendanceRecords({ date: selectedDate }),
        ]);
        if (!bookingsResponse.success) {
          throw new Error(bookingsResponse.message || "Failed to load bookings");
        }
        if (!cancelled) {
          setBookings(bookingsResponse.data || []);
          setAttendance(attendanceResponse?.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setBookings([]);
          setAttendance([]);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
    }

    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const attendanceByStaff = useMemo(() => {
    const map = new Map();
    for (const record of attendance) {
      const staffId = String(record.staff_id || record.staff?.id || "");
      if (!staffId || !record.punch_in_time) continue;
      const current = map.get(staffId);
      if (!current || new Date(record.punch_in_time) < new Date(current.punch_in_time)) {
        map.set(staffId, record);
      }
    }
    return map;
  }, [attendance]);

  useEffect(() => {
    if (dirty || !stylists.length || boardLoading) return;
    const ownerIds = stylists.filter(isSalonOwner).map((stylist) => String(stylist.id));
    if (savedIds) {
      const known = new Set(stylists.map((stylist) => String(stylist.id)));
      const next = savedIds.filter((id) => known.has(id));
      setSelectedIds([...new Set([...ownerIds, ...next])]);
      return;
    }
    const punchedIds = stylists
      .filter((stylist) => attendanceByStaff.has(String(stylist.id)))
      .map((stylist) => String(stylist.id));
    setSelectedIds([...new Set([...ownerIds, ...punchedIds])]);
  }, [dirty, stylists, boardLoading, savedIds, attendanceByStaff]);

  const visibleStylists = useMemo(() => {
    const selected = new Set(selectedIds);
    return [...stylists]
      .filter((stylist) => isSalonOwner(stylist) || selected.has(String(stylist.id)))
      .sort((left, right) => {
        const ownerDelta = Number(isSalonOwner(right)) - Number(isSalonOwner(left));
        if (ownerDelta) return ownerDelta;
        return stylistLabel(left).localeCompare(stylistLabel(right));
      });
  }, [stylists, selectedIds]);

  const bookingsByStaff = useMemo(() => {
    const map = new Map();
    for (const booking of bookings) {
      if (booking.status === "cancelled") continue;
      const staffId = String(booking.stylist_id || booking.staff_id || "");
      if (!map.has(staffId)) map.set(staffId, []);
      map.get(staffId).push(booking);
    }
    return map;
  }, [bookings]);

  const axisEndMin = axisEndFor(selectedDate, now);
  const boardWidth = ((axisEndMin - AXIS_START_MIN) / 60) * PX_PER_HOUR;
  const marks = hourMarks(axisEndMin);

  const summary = useMemo(() => {
    const visibleIds = new Set(visibleStylists.map((stylist) => String(stylist.id)));
    const visibleBookings = bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      return visibleIds.has(String(booking.stylist_id || booking.staff_id || ""));
    });
    return {
      total: visibleBookings.length,
      active: visibleBookings.filter((booking) =>
        ["booked", "confirmed", "in_progress"].includes(booking.status)
      ).length,
      punchedIn: attendanceByStaff.size,
    };
  }, [bookings, visibleStylists, attendanceByStaff]);

  function toggleStaff(staffId) {
    const stylist = stylists.find((entry) => String(entry.id) === staffId);
    if (stylist && isSalonOwner(stylist)) return;
    setDirty(true);
    setSaveNote("");
    setSelectedIds((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId]
    );
  }

  function saveChoice() {
    const ids = [...new Set(selectedIds.map(String))];
    localStorage.setItem(STAFF_CHOICE_KEY, JSON.stringify(ids));
    setSavedIds(ids);
    setDirty(false);
    setSaveNote("Saved. This list will open next time.");
  }

  function openNewBooking(staffId, bar, event) {
    if (!canCreate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
    const raw = bar.start + ratio * (bar.end - bar.start);
    const snapped = Math.round(raw / 15) * 15;
    const latest = Math.max(bar.start, bar.end - 15);
    const minutes = Math.min(Math.max(snapped, bar.start), latest);
    const params = new URLSearchParams({
      stylist_id: staffId,
      date: selectedDate,
      time: clockFromMinutes(minutes),
    });
    navigate(`/bookings/new?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="page booking-calendar-page">
        <p>Loading calendar…</p>
      </div>
    );
  }

  return (
    <div className="page booking-calendar-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Stylist calendar</h1>
          <p>
            Day board from 10:00 AM. Salon Owner’s bar starts at 10:00 AM and grows with the clock, including past 10:00 PM. Every other bar runs from punch-in to punch-out.
          </p>
        </div>
        <div className="module-hero-actions booking-page-actions">
          {canCreate && (
            <Link to="/bookings/new" className="module-hero-btn">
              + New booking
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
          <span className="user-summary-label">Punched in</span>
          <strong>{summary.punchedIn}</strong>
        </div>
      </section>

      <div className="booking-calendar-toolbar">
        <label className="booking-date-filter">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </div>

      <section className="status-card booking-staff-picker">
        <div className="booking-staff-picker__header">
          <div>
            <h2>Employees on the graph</h2>
            <p>
              Salon Owner stays on the board. Until you save, everyone who punched in on this day is included.
            </p>
          </div>
          <button type="button" className="user-primary-btn" onClick={saveChoice}>
            Save choice
          </button>
        </div>
        {saveNote ? <p className="booking-form-hint">{saveNote}</p> : null}
        <div className="booking-staff-picker__list">
          {stylists.map((stylist) => {
            const id = String(stylist.id);
            const owner = isSalonOwner(stylist);
            const checked = owner || selectedIds.includes(id);
            return (
              <label key={id} className={owner ? "is-owner" : ""}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={owner}
                  onChange={() => toggleStaff(id)}
                />
                <span>{stylistLabel(stylist)}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="status-card booking-calendar-card">
        <div className="booking-calendar-card__header">
          <div>
            <h2>{formatDayHeading(selectedDate)}</h2>
            <p className="booking-calendar-card__subtitle">
              {formatAxisHour(AXIS_START_MIN)} – {formatAxisHour(axisEndMin)}
            </p>
          </div>
          <Link to="/bookings" className="user-secondary-btn">
            Open queue
          </Link>
        </div>

        {boardLoading && <p className="booking-form-hint">Loading day board…</p>}

        {!boardLoading && visibleStylists.length === 0 ? (
          <p className="page-note">Choose at least one employee to show on the graph.</p>
        ) : null}

        {!boardLoading && visibleStylists.length > 0 ? (
          <div className="booking-board-scroll">
            <div className="booking-board" style={{ minWidth: `${168 + boardWidth}px` }}>
              {visibleStylists.map((stylist) => {
                const staffId = String(stylist.id);
                const owner = isSalonOwner(stylist);
                const ownerSpan = owner ? ownerBar(selectedDate, now, axisEndMin) : null;
                const bar = owner
                  ? ownerSpan
                  : punchBar(attendanceByStaff.get(staffId), selectedDate, axisEndMin);
                const lanes = assignLanes(bookingsByStaff.get(staffId) || []);
                const laneCount = Math.max(bar ? 1 : 0, lanes.reduce((max, item) => Math.max(max, item.lane + 1), 0));
                const rowHeight = Math.max(48, laneCount * LANE_HEIGHT + 10);

                return (
                  <div key={staffId} className="booking-board-row" style={{ minHeight: `${rowHeight}px` }}>
                    <div className="booking-board-name">
                      <strong>{stylistLabel(stylist)}</strong>
                      <span>{stylist.designation || (isSalonOwner(stylist) ? "Owner" : "Stylist")}</span>
                    </div>
                    <div className="booking-board-track" style={{ width: `${boardWidth}px` }}>
                      {marks.slice(0, -1).map((mark) => (
                        <span
                          key={`${staffId}-${mark}`}
                          className="booking-board-gridline"
                          style={{ left: `${((mark - AXIS_START_MIN) / 60) * PX_PER_HOUR}px` }}
                        />
                      ))}
                      {bar ? (
                        <button
                          type="button"
                          className={`booking-board-bar${owner ? " is-owner" : ""}`}
                          style={{
                            left: `${((bar.start - AXIS_START_MIN) / 60) * PX_PER_HOUR}px`,
                            width: `${(((owner ? bar.clickEnd : bar.end) - bar.start) / 60) * PX_PER_HOUR}px`,
                          }}
                          title={
                            canCreate
                              ? "Click an empty part of the bar to book this time"
                              : "Punched-in hours"
                          }
                          onClick={(event) =>
                            openNewBooking(
                              staffId,
                              owner ? { start: bar.start, end: bar.clickEnd } : bar,
                              event
                            )
                          }
                        >
                          {owner ? (
                            <span
                              className="booking-board-bar__fill"
                              style={{
                                width: `${bar.clickEnd > bar.start ? ((bar.end - bar.start) / (bar.clickEnd - bar.start)) * 100 : 0}%`,
                              }}
                            />
                          ) : null}
                        </button>
                      ) : null}
                      {lanes.map(({ booking, lane, start, end }) => (
                        <button
                          key={booking.id}
                          type="button"
                          className={`booking-board-block ${booking.status}`}
                          style={{
                            left: `${((Math.max(start, AXIS_START_MIN) - AXIS_START_MIN) / 60) * PX_PER_HOUR}px`,
                            width: `${Math.max(((Math.min(end, axisEndMin) - Math.max(start, AXIS_START_MIN)) / 60) * PX_PER_HOUR, 72)}px`,
                            top: `${6 + lane * LANE_HEIGHT}px`,
                            height: `${LANE_HEIGHT - 8}px`,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenBooking(booking);
                          }}
                        >
                          <strong>{booking.customer_name || "Customer"}</strong>
                          <span>{booking.service_label || "Service"}</span>
                          <span>{formatTime(booking.start_time)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="booking-board-axis">
                <div className="booking-board-name booking-board-name--axis" />
                <div className="booking-board-axis-scale" style={{ width: `${boardWidth}px` }}>
                  {marks.map((mark, index) => (
                    <span
                      key={mark}
                      className={
                        index === 0 ? "is-first" : index === marks.length - 1 ? "is-last" : ""
                      }
                      style={{ left: `${((mark - AXIS_START_MIN) / 60) * PX_PER_HOUR}px` }}
                    >
                      {formatAxisHour(mark)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {openBooking ? (
        <div className="booking-board-dialog" role="dialog" aria-modal="true" aria-label="Booking">
          <button type="button" className="booking-board-dialog__backdrop" onClick={() => setOpenBooking(null)} />
          <div className="booking-board-dialog__card">
            <div className="booking-calendar-card__header">
              <div>
                <h2>{openBooking.customer_name || "Customer"}</h2>
                <p className="booking-calendar-card__subtitle">
                  {formatTime(openBooking.start_time)} – {formatTime(openBooking.end_time)}
                </p>
              </div>
              <button type="button" className="user-secondary-btn" onClick={() => setOpenBooking(null)}>
                Close
              </button>
            </div>
            <p><strong>Service:</strong> {openBooking.service_label || "Service"}</p>
            <p><strong>Stylist:</strong> {openBooking.staff_name || stylistLabel(openBooking.stylist)}</p>
            <p><strong>Status:</strong> {formatStatus(openBooking.status)}</p>
            {openBooking.notes ? <p><strong>Notes:</strong> {openBooking.notes}</p> : null}
            {openBooking.status === "completed" ? (
              <BookingBillingHandoff bookingId={openBooking.id} />
            ) : null}
            <Link to="/bookings" className="user-secondary-btn" style={{ marginTop: "0.75rem" }}>
              Open queue
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
