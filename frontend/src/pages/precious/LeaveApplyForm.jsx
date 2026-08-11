import { useState } from "react";
import { preciousApi } from "../../api/index.js";
import {
  defaultLeaveDateIso,
  isAllowedLeaveDateIso,
  LEAVE_TYPE_OPTIONS,
} from "./leaveUtils.js";

const BLACKOUT_MESSAGE = "Leave cannot be taken on Friday, Saturday or Sunday.";

export default function LeaveApplyForm({
  staffId = "",
  staffOptions = [],
  onStaffChange,
  canSelectStaff = false,
}) {
  const [date, setDate] = useState(defaultLeaveDateIso);
  const [leaveType, setLeaveType] = useState("weekly_off");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleDateChange(nextDate) {
    setDate(nextDate);
    setError("");
    setSuccess("");
    if (nextDate && !isAllowedLeaveDateIso(nextDate)) {
      setError(BLACKOUT_MESSAGE);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!date) {
      setError("Date is required.");
      return;
    }
    if (!isAllowedLeaveDateIso(date)) {
      setError(BLACKOUT_MESSAGE);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        date,
        leave_type: leaveType,
        reason: reason.trim(),
      };
      if (staffId) payload.staff_id = staffId;

      const res = await preciousApi.requestLeave(payload);
      if (!res?.success) {
        throw new Error(res?.message || "Leave request failed");
      }

      const paid = res.data?.is_paid ? "paid" : "unpaid";
      setSuccess(`Leave submitted as pending (${paid}).`);
      setReason("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Leave request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="leave-apply-form" onSubmit={handleSubmit}>
      <p className="leave-apply-hint">Monday–Thursday only. Friday–Sunday are blocked.</p>

      {canSelectStaff && staffOptions.length > 0 ? (
        <label className="attendance-search-field">
          Employee
          <select value={staffId || ""} onChange={(e) => onStaffChange?.(e.target.value)}>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="attendance-search-field">
        Date
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} required />
      </label>

      <label className="attendance-search-field">
        Leave type
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
          {LEAVE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="attendance-search-field leave-apply-reason">
        Reason (optional)
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you need this day off?"
        />
      </label>

      {error ? (
        <p className="attendance-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="attendance-success" role="status">
          {success}
        </p>
      ) : null}

      <button type="submit" className="user-primary-btn" disabled={busy}>
        {busy ? "Submitting…" : "Submit leave request"}
      </button>
    </form>
  );
}
