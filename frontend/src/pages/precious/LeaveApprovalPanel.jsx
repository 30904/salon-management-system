import { useCallback, useEffect, useState } from "react";
import { preciousApi } from "../../api/index.js";

function formatLeaveDate(value) {
  if (!value) return "—";
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function leaveTypeLabel(type) {
  if (type === "weekly_off") return "Weekly off";
  if (type === "extra_leave") return "Extra leave";
  if (type === "swapped_off") return "Swapped off";
  return type || "—";
}

export default function LeaveApprovalPanel({ canDecide = false }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await preciousApi.listLeave({ status: "pending" });
      if (!res?.success) throw new Error(res?.message || "Failed to load pending leave");
      setLeaves(res.data?.leaves || []);
    } catch (err) {
      setLeaves([]);
      setError(err.response?.data?.message || err.message || "Failed to load pending leave");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function decide(leave, action) {
    setNotice("");
    setError("");
    setBusyId(leave.id);
    try {
      const res =
        action === "approve"
          ? await preciousApi.approveLeave(leave.id)
          : await preciousApi.rejectLeave(leave.id);
      if (!res?.success) throw new Error(res?.message || `Failed to ${action} leave`);
      setNotice(
        action === "approve"
          ? `Approved ${leave.staff_name || "staff"} for ${formatLeaveDate(leave.date)}.`
          : `Rejected ${leave.staff_name || "staff"} for ${formatLeaveDate(leave.date)}.`
      );
      await loadPending();
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to ${action} leave`);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="attendance-table-panel">
      <div className="attendance-table-toolbar">
        <strong>Pending leave = {loading ? "…" : leaves.length}</strong>
        <button type="button" className="user-secondary-btn" onClick={loadPending} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="attendance-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="attendance-success" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p>Loading pending leave…</p>
      ) : leaves.length === 0 ? (
        <p className="page-note">No pending leave requests.</p>
      ) : (
        <div className="attendance-table-wrap">
          <table className="attendance-data-table leave-approval-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Type</th>
                <th>Paid</th>
                <th>Reason</th>
                <th>Clash</th>
                <th className="col-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => {
                const clashBlocked = leave.clash && leave.clash.allowed === false;
                return (
                  <tr key={leave.id}>
                    <td>{formatLeaveDate(leave.date)}</td>
                    <td className="attendance-employee-cell">
                      <strong>{leave.staff_name || "—"}</strong>
                    </td>
                    <td>{leave.designation || "—"}</td>
                    <td>{leaveTypeLabel(leave.leave_type)}</td>
                    <td>{leave.is_paid ? "Paid" : "Unpaid"}</td>
                    <td>{leave.reason || "—"}</td>
                    <td>
                      {clashBlocked ? (
                        <span className="leave-clash-warning" title={leave.clash.reason}>
                          {leave.clash.reason}
                        </span>
                      ) : (
                        <span className="leave-clash-ok">No clash</span>
                      )}
                    </td>
                    <td className="col-center">
                      <div className="leave-approval-actions">
                        <button
                          type="button"
                          className="user-primary-btn"
                          disabled={!canDecide || busyId === leave.id}
                          onClick={() => decide(leave, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="user-secondary-btn"
                          disabled={!canDecide || busyId === leave.id}
                          onClick={() => decide(leave, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
