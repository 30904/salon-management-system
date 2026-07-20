import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { arnavApi, preciousApi } from "../../api/index.js";
import { usePermission } from "../../hooks/usePermission.js";
import {
  enrichStaffProfiles,
  formatShiftRange,
  getEmployeeCode,
  getExpectedHours,
  getStaffDisplayName,
  getStaffShift,
  isWeeklyOffDay,
  resolveDayStatus,
  resolveRecordStaffId,
  statusClass,
  statusLabel,
} from "./attendanceUtils.js";
import "./AttendanceHome.css";

function isoDayKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function formatDayShortUTC(dateObj) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dateObj.getUTCDay()] || "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeISODateUTC(year, month1to12, day1to31) {
  return `${year}-${pad2(month1to12)}-${pad2(day1to31)}`;
}

function formatTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStaffLocation(staff) {
  return staff?.user?.branch?.name || staff?.user?.branch_id?.name || "Main Branch";
}

function getStaffDepartment(staff) {
  return staff?.designation || "Salon Staff";
}

function IconFingerprint({ active }) {
  return (
    <span className={`attendance-icon-btn ${active ? "is-active" : ""}`} title={active ? "Punched via app" : "No punch"}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2C9.8 2 8 3.8 8 6v2M16 6V4a4 4 0 00-8 0v2M7 11v1a5 5 0 0010 0v-1M12 18v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M9 14a3 3 0 006 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function IconComment({ hasRemarks, remarks }) {
  return (
    <span
      className={`attendance-icon-btn ${hasRemarks ? "has-remarks" : ""}`}
      title={hasRemarks ? remarks : "No remarks"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 8h10M7 12h6M6 4h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 3v-3H6a2 2 0 01-2-2V6a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function EwhBadge({ workingHrs, expectedHrs, status }) {
  if (status === "weekly_off") {
    return <span className="attendance-ewh-badge neutral">—</span>;
  }
  if (workingHrs == null || expectedHrs == null) {
    return <span className="attendance-ewh-badge neutral">—</span>;
  }
  const met = workingHrs >= expectedHrs;
  return (
    <span className={`attendance-ewh-badge ${met ? "met" : "short"}`} title={met ? "Met expected hours" : "Below expected hours"}>
      {met ? "✓" : "!"}
    </span>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`attendance-status-pill ${statusClass(status)}`}>
      <span className="attendance-status-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export default function AttendanceHome() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("attendance", "create");
  const [activeTab, setActiveTab] = useState("summary");

  const now = new Date();
  const initialYear = now.getUTCFullYear();
  const initialMonth = now.getUTCMonth() + 1;

  const [staffProfiles, setStaffProfiles] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState(null);

  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const [remarkSearch, setRemarkSearch] = useState("");

  const [logDate, setLogDate] = useState(makeISODateUTC(initialYear, initialMonth, now.getUTCDate()));
  const [logStaffFilter, setLogStaffFilter] = useState("all");
  const [logRows, setLogRows] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(null);

  const [punchStatus, setPunchStatus] = useState(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchRemarks, setPunchRemarks] = useState("");

  const [summaryEntry, setSummaryEntry] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 7;

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setStaffLoading(true);
      setStaffError(null);
      try {
        const [staffRes, usersRes] = await Promise.all([
          fetchStaffProfiles({ is_active: "true" }),
          arnavApi.listUsers({ is_active: "true" }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        const list = staffRes?.data || [];
        const users = usersRes?.data || [];
        const enriched = enrichStaffProfiles(list, users);
        setStaffProfiles(enriched);
        if (!selectedStaffId) {
          setSelectedStaffId(enriched[0]?.id || enriched[0]?._id || null);
        }
      } catch (err) {
        if (!cancelled) {
          setStaffError(err.response?.data?.message || err.message || "Failed to load staff list");
        }
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    }

    loadStaff();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStaff = useMemo(() => {
    return staffProfiles.find((s) => String(s.id || s._id) === String(selectedStaffId)) || null;
  }, [staffProfiles, selectedStaffId]);

  const selectedStaffName = useMemo(() => {
    return getStaffDisplayName(selectedStaff, summaryEntry?.user);
  }, [selectedStaff, summaryEntry]);

  const selectedShift = useMemo(() => getStaffShift(selectedStaff), [selectedStaff]);

  useEffect(() => {
    if (!selectedStaffId) return;
    let cancelled = false;

    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      setPage(1);
      try {
        const res = await preciousApi.getAttendanceSummary({
          month,
          year,
          staff_id: selectedStaffId,
        });

        if (cancelled) return;
        if (!res.success) throw new Error(res.message || "Failed to load attendance summary");

        setSummaryEntry(res.data?.payroll_summaries?.[0] || null);
      } catch (err) {
        if (!cancelled) setSummaryError(err.response?.data?.message || err.message || "Failed");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [month, year, selectedStaffId]);

  useEffect(() => {
    if (activeTab !== "punch" || !selectedStaffId) return;
    let cancelled = false;

    async function loadStatus() {
      setPunchLoading(true);
      setPunchRemarks("");
      try {
        const res = await preciousApi.getAttendanceStatus({ staff_id: selectedStaffId });
        if (!cancelled) setPunchStatus(res?.data || null);
      } catch {
        if (!cancelled) setPunchStatus(null);
      } finally {
        if (!cancelled) setPunchLoading(false);
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedStaffId]);

  const summaryRecordsByDay = useMemo(() => {
    const map = new Map();
    (summaryEntry?.records || []).forEach((r) => map.set(isoDayKey(r.date), r));
    return map;
  }, [summaryEntry]);

  const monthDays = useMemo(() => {
    const arr = [];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      arr.push(new Date(Date.UTC(year, month - 1, day, 0, 0, 0)));
    }
    return arr;
  }, [year, month]);

  const expectedHrs = useMemo(() => getExpectedHours(selectedShift), [selectedShift]);
  const shiftRangeText = useMemo(() => formatShiftRange(selectedShift), [selectedShift]);

  const summaryRows = useMemo(() => {
    const q = remarkSearch.trim().toLowerCase();

    return monthDays
      .map((dateObj) => {
        const dayKey = isoDayKey(dateObj);
        const rec = summaryRecordsByDay.get(dayKey) || null;
        const status = resolveDayStatus({ record: rec, dateObj });

        const punchIn = rec?.punch_in_time ? new Date(rec.punch_in_time) : null;
        const punchOut = rec?.punch_out_time ? new Date(rec.punch_out_time) : null;

        const workingHrs =
          punchIn && punchOut
            ? Number(((punchOut - punchIn) / (1000 * 60 * 60)).toFixed(2))
            : null;

        return {
          id: dayKey,
          dateObj,
          rec,
          status,
          punchIn,
          punchOut,
          workingHrs,
          expectedHrs,
          shiftText: shiftRangeText,
          remarks: rec?.remarks || "",
          weeklyOff: isWeeklyOffDay(dateObj),
        };
      })
      .filter((row) => {
        if (!q) return true;
        return (row.remarks || "").toLowerCase().includes(q);
      });
  }, [monthDays, remarkSearch, expectedHrs, shiftRangeText, summaryRecordsByDay]);

  const summaryPagination = useMemo(() => {
    const total = summaryRows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return {
      total,
      pages,
      currentPage,
      rows: summaryRows.slice(start, end),
    };
  }, [page, summaryRows]);

  async function loadLog({ silent = false } = {}) {
    if (!silent) {
      setLogLoading(true);
      setLogRows([]);
    }
    setLogError(null);
    try {
      const params = { date: logDate };
      if (logStaffFilter !== "all") params.staff_id = logStaffFilter;

      const res = await preciousApi.getAttendanceRecords(params);
      if (!res.success) throw new Error(res.message || "Failed to load attendance log");

      const recordMap = new Map();
      (res.data || []).forEach((r) => {
        const staffKey = resolveRecordStaffId(r);
        if (staffKey) recordMap.set(staffKey, r);
      });

      const logDateObj = new Date(`${logDate}T00:00:00Z`);

      const filteredStaff =
        logStaffFilter === "all"
          ? staffProfiles
          : staffProfiles.filter((s) => String(s.id || s._id) === String(logStaffFilter));

      const rows = filteredStaff.map((s) => {
        const sid = String(s.id || s._id);
        const rec = recordMap.get(sid) || null;
        const status = rec?.status
          ? rec.status
          : isWeeklyOffDay(logDateObj)
            ? "weekly_off"
            : "not_punched_in";

        const punchIn = rec?.punch_in_time ? new Date(rec.punch_in_time) : null;
        const punchOut = rec?.punch_out_time ? new Date(rec.punch_out_time) : null;
        const shift = getStaffShift(s);
        const rowExpectedHrs = getExpectedHours(shift);

        const workingHrs =
          punchIn && punchOut
            ? Number(((punchOut - punchIn) / (1000 * 60 * 60)).toFixed(2))
            : null;

        return {
          id: sid,
          staff: s,
          rec,
          status,
          punchIn,
          punchOut,
          workingHrs,
          expectedHrs: rowExpectedHrs,
          shift,
        };
      });

      setLogRows(rows);
    } catch (err) {
      if (!silent) setLogRows([]);
      setLogError(err?.message || "Failed to load attendance log");
    } finally {
      if (!silent) setLogLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "log") return;
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logDate, logStaffFilter, staffProfiles]);

  useEffect(() => {
    if (activeTab !== "log") return;

    const intervalId = window.setInterval(() => loadLog({ silent: true }), 15000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logDate, logStaffFilter, staffProfiles]);

  useEffect(() => {
    if (activeTab !== "log") return;

    function refreshOnFocus() {
      loadLog({ silent: true });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadLog({ silent: true });
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logDate, logStaffFilter, staffProfiles]);

  async function handlePunch(type) {
    if (!selectedStaffId || !canCreate) return;

    setPunchLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        staff_id: selectedStaffId,
        punch_time: nowIso,
        remarks: punchRemarks?.trim() || "",
      };

      const res = type === "in" ? await preciousApi.punchIn(payload) : await preciousApi.punchOut(payload);
      if (!res.success) throw new Error(res.message || "Punch failed");

      const statusRes = await preciousApi.getAttendanceStatus({ staff_id: selectedStaffId });
      setPunchStatus(statusRes?.data || null);

      const summaryRes = await preciousApi.getAttendanceSummary({ month, year, staff_id: selectedStaffId });
      if (summaryRes.success) setSummaryEntry(summaryRes.data?.payroll_summaries?.[0] || null);

      if (activeTab === "log") {
        await loadLog({ silent: true });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Punch failed:", err);
    } finally {
      setPunchLoading(false);
    }
  }

  const initials = useMemo(() => {
    const parts = String(selectedStaffName).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    if (parts.length === 1) return `${parts[0][0] || ""}`.toUpperCase();
    return "S";
  }, [selectedStaffName]);

  const metrics = {
    present: summaryEntry?.days_present || 0,
    absent: summaryEntry?.days_absent || 0,
    halfDays: summaryEntry?.days_half_day || 0,
    lateMarks: summaryEntry?.days_late || 0,
  };

  return (
    <div className="page attendance-page">
      <header className="page-header">
        <p className="app-eyebrow">Attendance</p>
        <h1>
          {activeTab === "log"
            ? "Attendance Log"
            : activeTab === "punch"
              ? "Punch in / out"
              : "Attendance Summary"}
        </h1>
        <p className="page-description">
          {activeTab === "summary"
            ? "Month-wise attendance summary used for payroll."
            : activeTab === "log"
              ? "Daily punch records from mobile app and web — refreshes automatically."
              : "Start/end attendance for payroll."}
        </p>
      </header>

      <div className="attendance-tabs">
        <button
          type="button"
          className={`attendance-tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Attendance Summary
        </button>
        <button
          type="button"
          className={`attendance-tab-btn ${activeTab === "log" ? "active" : ""}`}
          onClick={() => setActiveTab("log")}
        >
          Attendance Log
        </button>
        <button
          type="button"
          className={`attendance-tab-btn ${activeTab === "punch" ? "active" : ""}`}
          onClick={() => setActiveTab("punch")}
        >
          Punch in / out
        </button>
      </div>

      {staffLoading ? (
        <p>Loading attendance data…</p>
      ) : staffError ? (
        <p className="status-error">{staffError}</p>
      ) : (
        <>
          {activeTab === "summary" && (
            <>
              <div className="attendance-card-row">
                <div className="attendance-employee-meta">
                  <div className="attendance-employee-top">
                    <div className="attendance-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="attendance-employee-name">
                      <strong>{selectedStaffName}</strong>
                      <span>{getStaffDepartment(selectedStaff)}</span>
                    </div>
                  </div>

                  <div className="attendance-ee-code">EE {getEmployeeCode(selectedStaff)}</div>

                  <div className="attendance-profile-grid">
                    <div className="attendance-profile-detail">
                      <span>Department</span>
                      <strong>{getStaffDepartment(selectedStaff)}</strong>
                    </div>
                    <div className="attendance-profile-detail">
                      <span>Location</span>
                      <strong>{getStaffLocation(selectedStaff)}</strong>
                    </div>
                  </div>

                  <div className="attendance-meta-lines">
                    <div className="attendance-meta-line">
                      <strong>Time</strong>
                      <div>{shiftRangeText}</div>
                    </div>
                    <div className="attendance-meta-line">
                      <strong>Shift</strong>
                      <div>{selectedShift?.name || "General shift"}</div>
                    </div>
                    <div className="attendance-meta-line">
                      <strong>Expected hours</strong>
                      <div>{expectedHrs != null ? `${expectedHrs} hrs` : "—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "1rem" }}>
                  <div className="attendance-search-row" style={{ marginBottom: 0 }}>
                    <label className="attendance-search-field">
                      Employee
                      <select value={selectedStaffId || ""} onChange={(e) => setSelectedStaffId(e.target.value)}>
                        {staffProfiles.map((s) => (
                          <option key={s.id || s._id} value={s.id || s._id}>
                            {getStaffDisplayName(s)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="attendance-search-field" style={{ maxWidth: 240 }}>
                      Month
                      <select
                        value={year * 100 + month}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setYear(Math.floor(v / 100));
                          setMonth(v % 100);
                        }}
                      >
                        {Array.from({ length: 18 }).map((_, idx) => {
                          const d = new Date(Date.UTC(initialYear, initialMonth - 1, 1));
                          d.setUTCMonth(d.getUTCMonth() - idx);
                          const m = d.getUTCMonth() + 1;
                          const y = d.getUTCFullYear();
                          const label = d.toLocaleDateString("en-IN", {
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                          });
                          return (
                            <option key={`${y}-${m}`} value={y * 100 + m}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>

                  <div className="attendance-search-row">
                    <label className="attendance-search-field">
                      Search by remarks…
                      <input
                        type="text"
                        value={remarkSearch}
                        onChange={(e) => setRemarkSearch(e.target.value)}
                        placeholder="Search by remarks…"
                      />
                    </label>

                    <div style={{ display: "grid", alignContent: "end" }}>
                      <Link to="/settings/staff" className="quick-nav-link">
                        Manage staff →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {summaryLoading ? (
                <p>Loading summary…</p>
              ) : summaryError ? (
                <p className="status-error">{summaryError}</p>
              ) : (
                <>
                  <section className="attendance-metric-grid">
                    <div className="attendance-metric-card">
                      <div className="attendance-metric-label">Present MTD</div>
                      <div className="attendance-metric-value" style={{ color: "#065f46" }}>
                        {metrics.present}
                      </div>
                    </div>
                    <div className="attendance-metric-card">
                      <div className="attendance-metric-label">Half Days MTD</div>
                      <div className="attendance-metric-value" style={{ color: "#92400e" }}>
                        {metrics.halfDays}
                      </div>
                    </div>
                    <div className="attendance-metric-card">
                      <div className="attendance-metric-label">Absent MTD</div>
                      <div className="attendance-metric-value" style={{ color: "#991b1b" }}>
                        {metrics.absent}
                      </div>
                    </div>
                    <div className="attendance-metric-card">
                      <div className="attendance-metric-label">Late Marks MTD</div>
                      <div className="attendance-metric-value" style={{ color: "#1d4ed8" }}>
                        {metrics.lateMarks}
                      </div>
                    </div>
                  </section>

                  <section className="attendance-table-panel">
                    <div className="attendance-table-toolbar">
                      <strong>Total Records = {summaryPagination.total}</strong>
                      <div className="attendance-page-indicator">
                        Page {summaryPagination.currentPage} of {summaryPagination.pages}
                      </div>
                    </div>

                    <div className="attendance-table-wrap">
                      <table className="attendance-data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Punch In</th>
                            <th>Punch Out</th>
                            <th className="col-center">Working Hrs</th>
                            <th className="col-center">EWH</th>
                            <th className="col-center">Expected</th>
                            <th className="col-center">Mode</th>
                            <th>Shift</th>
                            <th className="col-center">Remarks</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryPagination.rows.map((row) => (
                            <tr key={row.id} className={row.weeklyOff ? "attendance-row-weekly_off" : ""}>
                              <td>{row.dateObj.toLocaleDateString("en-IN", { timeZone: "UTC" })}</td>
                              <td>{formatDayShortUTC(row.dateObj)}</td>
                              <td>{row.punchIn ? formatTime(row.punchIn) : "—"}</td>
                              <td>{row.punchOut ? formatTime(row.punchOut) : "—"}</td>
                              <td className="col-center">{row.workingHrs != null ? row.workingHrs : "—"}</td>
                              <td className="col-center">
                                <EwhBadge workingHrs={row.workingHrs} expectedHrs={row.expectedHrs} status={row.status} />
                              </td>
                              <td className="col-center">{row.expectedHrs != null ? row.expectedHrs : "—"}</td>
                              <td className="col-center">
                                <IconFingerprint active={Boolean(row.punchIn)} />
                              </td>
                              <td>{row.shiftText}</td>
                              <td className="col-center">
                                <IconComment hasRemarks={Boolean(row.remarks)} remarks={row.remarks} />
                              </td>
                              <td>
                                <StatusPill status={row.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="attendance-pagination">
                      <button
                        type="button"
                        className="user-secondary-btn"
                        style={{ padding: "0.35rem 0.7rem" }}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={summaryPagination.currentPage <= 1}
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        className="user-secondary-btn"
                        style={{ padding: "0.35rem 0.7rem" }}
                        onClick={() => setPage((p) => Math.min(summaryPagination.pages, p + 1))}
                        disabled={summaryPagination.currentPage >= summaryPagination.pages}
                      >
                        ▶
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {activeTab === "log" && (
            <section style={{ marginTop: "0.25rem" }}>
              <div className="attendance-search-row">
                <label className="attendance-search-field" style={{ maxWidth: 240 }}>
                  Date
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                </label>

                <label className="attendance-search-field" style={{ maxWidth: 340 }}>
                  Employee
                  <select value={logStaffFilter} onChange={(e) => setLogStaffFilter(e.target.value)}>
                    <option value="all">All employees</option>
                    {staffProfiles.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {getStaffDisplayName(s)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="user-secondary-btn"
                  onClick={() => loadLog()}
                  disabled={logLoading}
                  style={{ alignSelf: "flex-end" }}
                >
                  {logLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {logError ? (
                <p className="attendance-error" role="alert">
                  {logError}
                </p>
              ) : null}

              {logLoading ? (
                <p>Loading attendance log…</p>
              ) : (
                <section className="attendance-table-panel">
                  <div className="attendance-table-toolbar">
                    <strong>Total Records = {logRows.length}</strong>
                  </div>

                  <div className="attendance-table-wrap">
                    <table className="attendance-data-table">
                      <thead>
                        <tr>
                          <th>EE Code</th>
                          <th>Employee Name</th>
                          <th>Department</th>
                          <th>Punch In</th>
                          <th>Punch Out</th>
                          <th className="col-center">Work Hrs</th>
                          <th className="col-center">EWH</th>
                          <th className="col-center">Expected</th>
                          <th className="col-center">Mode</th>
                          <th>Status</th>
                          <th className="col-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logRows.map((row) => (
                          <tr key={row.id}>
                            <td>{getEmployeeCode(row.staff)}</td>
                            <td className="attendance-employee-cell">
                              <strong>{getStaffDisplayName(row.staff)}</strong>
                              <span>{getStaffDepartment(row.staff)}</span>
                            </td>
                            <td>{getStaffDepartment(row.staff)}</td>
                            <td>{row.punchIn ? formatTime(row.punchIn) : "—"}</td>
                            <td>{row.punchOut ? formatTime(row.punchOut) : "—"}</td>
                            <td className="col-center">{row.workingHrs != null ? row.workingHrs : "—"}</td>
                            <td className="col-center">
                              <EwhBadge workingHrs={row.workingHrs} expectedHrs={row.expectedHrs} status={row.status} />
                            </td>
                            <td className="col-center">{row.expectedHrs != null ? row.expectedHrs : "—"}</td>
                            <td className="col-center">
                              <IconFingerprint active={Boolean(row.punchIn)} />
                            </td>
                            <td>
                              <StatusPill status={row.status} />
                            </td>
                            <td className="col-center">
                              <button
                                type="button"
                                className="user-secondary-btn"
                                style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                                onClick={() => {
                                  setActiveTab("summary");
                                  setSelectedStaffId(row.id);
                                  const d = new Date(`${logDate}T00:00:00Z`);
                                  setMonth(d.getUTCMonth() + 1);
                                  setYear(d.getUTCFullYear());
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </section>
          )}

          {activeTab === "punch" && (
            <section style={{ marginTop: "0.5rem" }}>
              <div className="attendance-search-row" style={{ marginBottom: "1rem" }}>
                <label className="attendance-search-field" style={{ maxWidth: 360 }}>
                  Employee
                  <select value={selectedStaffId || ""} onChange={(e) => setSelectedStaffId(e.target.value)}>
                    {staffProfiles.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {getStaffDisplayName(s)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="attendance-search-field" style={{ maxWidth: 420 }}>
                  Remarks (optional)
                  <input
                    type="text"
                    value={punchRemarks}
                    onChange={(e) => setPunchRemarks(e.target.value)}
                    placeholder="Add remarks…"
                  />
                </label>
              </div>

              <section className="status-card" style={{ padding: "1.25rem" }}>
                {punchLoading ? (
                  <p>Loading punch status…</p>
                ) : !punchStatus ? (
                  <p className="page-note">No attendance status available for this staff.</p>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>{selectedStaffName}</strong>
                        <div style={{ color: "#64748b", fontWeight: 700, marginTop: "0.25rem" }}>
                          {punchStatus.is_punched_in ? "Punched in (open)" : "Not punched in"}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="user-primary-btn"
                          disabled={punchStatus.is_punched_in || !canCreate || punchLoading}
                          onClick={() => handlePunch("in")}
                          style={{ opacity: punchStatus.is_punched_in ? 0.6 : 1 }}
                        >
                          Punch In
                        </button>
                        <button
                          type="button"
                          className="user-secondary-btn"
                          disabled={!punchStatus.is_punched_in || !canCreate || punchLoading}
                          onClick={() => handlePunch("out")}
                          style={{ opacity: !punchStatus.is_punched_in ? 0.6 : 1 }}
                        >
                          Punch Out
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem", display: "grid", gap: "0.35rem" }}>
                      <div style={{ color: "#475569", fontWeight: 700 }}>
                        Open Punch In:
                        <span style={{ marginLeft: "0.5rem", color: "#0f172a" }}>
                          {punchStatus.open_record?.punch_in_time ? formatTime(punchStatus.open_record.punch_in_time) : "—"}
                        </span>
                      </div>
                      <div style={{ color: "#475569", fontWeight: 700 }}>
                        Today Record Status:
                        <span style={{ marginLeft: "0.5rem", color: "#0f172a" }}>
                          {punchStatus.today_record?.status ? statusLabel(punchStatus.today_record.status) : "—"}
                        </span>
                      </div>
                      <div style={{ color: "#475569", fontWeight: 700 }}>
                        Expected hours:
                        <span style={{ marginLeft: "0.5rem", color: "#0f172a" }}>
                          {expectedHrs != null ? `${expectedHrs} hrs` : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </section>
          )}
        </>
      )}
    </div>
  );
}
