import { useCallback, useEffect, useState } from "react";
import { attendanceApi, staffApi } from "../api/index.js";
import { useToast } from "../components/Toast.jsx";
import { usePermission } from "../hooks/usePermission.js";
import {
  formatDayShort,
  formatTime,
  getRecentRange,
  getWeekRange,
} from "../utils/format.js";
import { getCurrentPosition } from "../utils/geolocation.js";

function statusLabel(status) {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "half_day":
      return "Half day";
    case "on_leave":
      return "On leave";
    case "absent":
      return "Absent";
    default:
      return status ? String(status).replace(/_/g, " ") : "—";
  }
}

function AttendanceHistoryRow({ record }) {
  const status = record?.status || "absent";
  return (
    <li className={`attendance-history-row status-${status}`}>
      <div className="attendance-history-row__main">
        <strong>{formatDayShort(record.date)}</strong>
        <span className={`attendance-status-pill status-${status}`}>{statusLabel(status)}</span>
      </div>
      <div className="attendance-history-row__times">
        <span>In {formatTime(record.punch_in_time)}</span>
        <span>Out {formatTime(record.punch_out_time)}</span>
      </div>
      {record.remarks ? <p className="attendance-history-row__remarks">{record.remarks}</p> : null}
    </li>
  );
}

export default function Attendance() {
  const { isOwner } = usePermission();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [weekLeaves, setWeekLeaves] = useState([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;

    staffApi
      .fetchStaffProfiles({ is_active: "true" })
      .then((res) => {
        if (!cancelled) setStaffList(res?.data || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const loadHistory = useCallback(async (staffId) => {
    if (!staffId) {
      setHistory([]);
      setWeekLeaves([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const recent = getRecentRange(14);
      const week = getWeekRange();
      setWeekLabel(week.label);

      const [historyRes, leaveRes] = await Promise.all([
        attendanceApi.getAttendanceRecords({
          staff_id: staffId,
          from_date: recent.from_date,
          to_date: recent.to_date,
        }),
        attendanceApi.getAttendanceRecords({
          staff_id: staffId,
          from_date: week.from_date,
          to_date: week.to_date,
          status: "on_leave",
        }),
      ]);

      setHistory(historyRes?.success ? historyRes.data || [] : []);
      setWeekLeaves(leaveRes?.success ? leaveRes.data || [] : []);
    } catch (err) {
      setHistory([]);
      setWeekLeaves([]);
      setHistoryError(err.response?.data?.message || err.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);
      try {
        const params = selectedStaffId ? { staff_id: selectedStaffId } : {};
        const res = await attendanceApi.getAttendanceStatus(params);
        if (cancelled) return;
        const nextStatus = res?.data || null;
        setStatus(nextStatus);
        const staffId = selectedStaffId || nextStatus?.staff_id || "";
        if (staffId) await loadHistory(staffId);
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
          setHistory([]);
          setWeekLeaves([]);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [selectedStaffId, loadHistory]);

  async function handlePunch(action) {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        punch_time: new Date().toISOString(),
        remarks: remarks || undefined,
      };
      if (selectedStaffId) {
        payload.staff_id = selectedStaffId;
      } else {
        const location = await getCurrentPosition();
        payload.latitude = location.latitude;
        payload.longitude = location.longitude;
      }

      const res =
        action === "in" ? await attendanceApi.punchIn(payload) : await attendanceApi.punchOut(payload);

      if (!res.success) throw new Error(res.message || "Punch failed");

      showToast(
        action === "in" ? "Punched in successfully" : "Punched out successfully",
        "success"
      );
      setRemarks("");

      const params = selectedStaffId ? { staff_id: selectedStaffId } : {};
      const statusRes = await attendanceApi.getAttendanceStatus(params);
      const nextStatus = statusRes?.data || null;
      setStatus(nextStatus);
      const staffId = selectedStaffId || nextStatus?.staff_id || "";
      if (staffId) await loadHistory(staffId);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      showToast(msg || "Punch failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const isPunchedIn = Boolean(status?.is_punched_in);
  const punchInTime = status?.open_record?.punch_in_time;

  return (
    <div className="page-pad">
      <h1>Attendance</h1>

      {isOwner && (
        <label className="field">
          <span>Punch on behalf of</span>
          <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
            <option value="">Myself</option>
            {staffList.map((staff) => (
              <option key={staff.id || staff._id} value={staff.id || staff._id}>
                {staff.user?.name || staff.designation || "Staff"}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="form-error">{error}</p>}

      <section className={`punch-hero ${isPunchedIn ? "is-in" : ""}`}>
        {loading ? (
          <p>Loading status…</p>
        ) : (
          <>
            <p className="card-label">Status</p>
            <strong>{isPunchedIn ? `Punched in since ${formatTime(punchInTime)}` : "Not punched in"}</strong>
          </>
        )}
      </section>

      <label className="field">
        <span>Remarks (optional)</span>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Late due to traffic" />
      </label>

      <div className="punch-actions">
        <button
          type="button"
          className="btn btn-punch-in"
          disabled={busy || isPunchedIn}
          onClick={() => handlePunch("in")}
        >
          Punch In
        </button>
        <button
          type="button"
          className="btn btn-punch-out"
          disabled={busy || !isPunchedIn}
          onClick={() => handlePunch("out")}
        >
          Punch Out
        </button>
      </div>

      <section className="attendance-panel">
        <div className="attendance-panel__header">
          <h2>This week’s leaves</h2>
          {weekLabel ? <span className="muted">{weekLabel}</span> : null}
        </div>
        {historyLoading ? (
          <p className="muted">Loading leaves…</p>
        ) : historyError ? (
          <p className="form-error">{historyError}</p>
        ) : weekLeaves.length === 0 ? (
          <p className="muted">No leave days marked this week.</p>
        ) : (
          <ul className="attendance-history-list">
            {weekLeaves.map((record) => (
              <AttendanceHistoryRow key={record.id || record._id} record={record} />
            ))}
          </ul>
        )}
      </section>

      <section className="attendance-panel">
        <div className="attendance-panel__header">
          <h2>Attendance history</h2>
          <span className="muted">Last 14 days</span>
        </div>
        {historyLoading ? (
          <p className="muted">Loading history…</p>
        ) : historyError ? (
          <p className="form-error">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="muted">No attendance records in the last 14 days.</p>
        ) : (
          <ul className="attendance-history-list">
            {history.map((record) => (
              <AttendanceHistoryRow key={record.id || record._id} record={record} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
