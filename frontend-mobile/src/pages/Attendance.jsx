import { useCallback, useEffect, useState } from "react";
import { attendanceApi, leaveApi, staffApi } from "../api/index.js";
import { useToast } from "../components/Toast.jsx";
import { usePermission } from "../hooks/usePermission.js";
import {
  formatDayShort,
  formatTime,
  getRecentRange,
  getWeekRange,
} from "../utils/format.js";
import { getCurrentPosition } from "../utils/geolocation.js";
import {
  defaultLeaveDateIso,
  isAllowedLeaveDateIso,
  leavesInRange,
  leaveTypeLabel,
  mergeLeavesIntoHistory,
  mergeWeeklyOffIntoHistory,
  monthsCoveringRange,
} from "../utils/leaveUtils.js";

const BLACKOUT_MESSAGE = "Leave cannot be taken on Friday, Saturday or Sunday.";

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
    case "leave_pending":
      return "Leave pending";
    case "weekly_off":
      return "Weekly off";
    case "absent":
      return "Absent";
    default:
      return status ? String(status).replace(/_/g, " ") : "—";
  }
}

function AttendanceHistoryRow({ record, leaveOnly = false }) {
  const status = record?.leave_status === "pending" ? "leave_pending" : record?.status || "absent";
  const leaveBits = [];
  if (record?.leave_type) leaveBits.push(leaveTypeLabel(record.leave_type));
  if (record?.leave_status) leaveBits.push(record.leave_status);
  if (record?.leave_status && record.is_paid != null) leaveBits.push(record.is_paid ? "paid" : "unpaid");

  return (
    <li className={`attendance-history-row status-${status}`}>
      <div className="attendance-history-row__main">
        <strong>{formatDayShort(record.date)}</strong>
        <span className={`attendance-status-pill status-${status}`}>{statusLabel(status)}</span>
      </div>
      {leaveBits.length ? <p className="attendance-history-row__leave">{leaveBits.join(" · ")}</p> : null}
      {!leaveOnly ? (
        <div className="attendance-history-row__times">
          <span>In {formatTime(record.punch_in_time)}</span>
          <span>Out {formatTime(record.punch_out_time)}</span>
        </div>
      ) : null}
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
  const [leaveDate, setLeaveDate] = useState(defaultLeaveDateIso);
  const [leaveType, setLeaveType] = useState("weekly_off");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
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

      const listed = staffList.find((s) => String(s.id || s._id) === String(staffId));
      let weeklyOffDay = listed?.weekly_off_day;
      if (weeklyOffDay == null) {
        try {
          const profileRes = await staffApi.getStaffProfile(staffId);
          weeklyOffDay = profileRes?.data?.weekly_off_day;
        } catch {
          weeklyOffDay = 1;
        }
      }

      const months = monthsCoveringRange(recent.from_date, recent.to_date);
      const [historyRes, ...leaveResponses] = await Promise.all([
        attendanceApi.getAttendanceRecords({
          staff_id: staffId,
          from_date: recent.from_date,
          to_date: recent.to_date,
        }),
        ...months.map((month) => leaveApi.listLeave({ staff_id: staffId, month })),
      ]);

      const records = historyRes?.success ? historyRes.data || [] : [];
      const leaves = leaveResponses.flatMap((res) => (res?.success ? res.data?.leaves || [] : []));
      const withWeeklyOff = mergeWeeklyOffIntoHistory(
        records,
        recent.from_date,
        recent.to_date,
        weeklyOffDay ?? 1
      );

      setHistory(mergeLeavesIntoHistory(withWeeklyOff, leaves));
      setWeekLeaves(leavesInRange(leaves, week.from_date, week.to_date));
    } catch (err) {
      setHistory([]);
      setWeekLeaves([]);
      setHistoryError(err.response?.data?.message || err.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, [staffList]);

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

  async function handleLeaveSubmit(event) {
    event.preventDefault();
    setLeaveError(null);

    if (!leaveDate) {
      setLeaveError("Date is required.");
      return;
    }
    if (!isAllowedLeaveDateIso(leaveDate)) {
      setLeaveError(BLACKOUT_MESSAGE);
      return;
    }

    setLeaveBusy(true);
    try {
      const payload = {
        date: leaveDate,
        leave_type: leaveType,
        reason: leaveReason.trim(),
      };
      if (selectedStaffId) payload.staff_id = selectedStaffId;

      const res = await leaveApi.requestLeave(payload);
      if (!res?.success) throw new Error(res?.message || "Leave request failed");

      const paid = res.data?.is_paid ? "paid" : "unpaid";
      showToast(`Leave submitted as pending (${paid})`, "success");
      setLeaveReason("");
      const staffId = selectedStaffId || status?.staff_id || "";
      if (staffId) await loadHistory(staffId);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Leave request failed";
      setLeaveError(msg);
      showToast(msg, "error");
    } finally {
      setLeaveBusy(false);
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

      <form className="attendance-panel" onSubmit={handleLeaveSubmit}>
        <div className="attendance-panel__header">
          <h2>Apply leave</h2>
          <span className="muted">Mon–Thu only</span>
        </div>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={leaveDate}
            onChange={(e) => {
              setLeaveDate(e.target.value);
              setLeaveError(
                e.target.value && !isAllowedLeaveDateIso(e.target.value) ? BLACKOUT_MESSAGE : null
              );
            }}
            required
          />
        </label>

        <label className="field">
          <span>Leave type</span>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            <option value="weekly_off">Weekly off</option>
            <option value="extra_leave">Extra leave</option>
          </select>
        </label>

        <label className="field">
          <span>Reason (optional)</span>
          <textarea
            rows={3}
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            placeholder="Why do you need this day off?"
          />
        </label>

        {leaveError ? <p className="form-error">{leaveError}</p> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={leaveBusy}>
          {leaveBusy ? "Submitting…" : "Submit leave request"}
        </button>
      </form>

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
          <p className="muted">No pending or approved leave this week.</p>
        ) : (
          <ul className="attendance-history-list">
            {weekLeaves.map((leave) => (
              <AttendanceHistoryRow
                key={leave.id || leave._id}
                leaveOnly
                record={{
                  ...leave,
                  status: leave.status === "approved" ? "on_leave" : "leave_pending",
                  leave_status: leave.status,
                }}
              />
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
