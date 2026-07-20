import { useEffect, useState } from "react";
import { attendanceApi, staffApi } from "../api/index.js";
import { useToast } from "../components/Toast.jsx";
import { usePermission } from "../hooks/usePermission.js";
import { formatTime } from "../utils/format.js";

export default function Attendance() {
  const { isOwner } = usePermission();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [status, setStatus] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);
      try {
        const params = selectedStaffId ? { staff_id: selectedStaffId } : {};
        const res = await attendanceApi.getAttendanceStatus(params);
        if (!cancelled) setStatus(res?.data || null);
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
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
  }, [selectedStaffId]);

  async function handlePunch(action) {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        punch_time: new Date().toISOString(),
        remarks: remarks || undefined,
      };
      if (selectedStaffId) payload.staff_id = selectedStaffId;

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
      setStatus(statusRes?.data || null);
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
    </div>
  );
}
