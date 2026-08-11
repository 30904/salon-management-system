import { useMemo, useState } from "react";
import { preciousApi } from "../../api/index.js";
import { defaultLeaveDateIso, isAllowedLeaveDateIso } from "./leaveUtils.js";

const BLACKOUT_MESSAGE = "Leave cannot be taken on Friday, Saturday or Sunday.";

export default function LeaveSwapForm({ staffOptions = [], canSwap = false }) {
  const [staffIdA, setStaffIdA] = useState(staffOptions[0]?.id || "");
  const [staffIdB, setStaffIdB] = useState(staffOptions[1]?.id || staffOptions[0]?.id || "");
  const [dateA, setDateA] = useState(defaultLeaveDateIso);
  const [dateB, setDateB] = useState(defaultLeaveDateIso);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const staffALabel = useMemo(
    () => staffOptions.find((s) => String(s.id) === String(staffIdA))?.label || "Staff A",
    [staffOptions, staffIdA]
  );
  const staffBLabel = useMemo(
    () => staffOptions.find((s) => String(s.id) === String(staffIdB))?.label || "Staff B",
    [staffOptions, staffIdB]
  );

  function validateDates(nextA = dateA, nextB = dateB) {
    if (nextA && !isAllowedLeaveDateIso(nextA)) return BLACKOUT_MESSAGE;
    if (nextB && !isAllowedLeaveDateIso(nextB)) return BLACKOUT_MESSAGE;
    return "";
  }

  function handleDateA(value) {
    setDateA(value);
    setSuccess("");
    setError(validateDates(value, dateB));
  }

  function handleDateB(value) {
    setDateB(value);
    setSuccess("");
    setError(validateDates(dateA, value));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!staffIdA || !staffIdB || !dateA || !dateB) {
      setError("Select both staff and both dates.");
      return;
    }
    if (String(staffIdA) === String(staffIdB)) {
      setError("Choose two different staff members.");
      return;
    }
    if (dateA === dateB) {
      setError("Swap dates must be different.");
      return;
    }
    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      return;
    }

    setBusy(true);
    try {
      const res = await preciousApi.swapLeave({
        staff_id_a: staffIdA,
        date_a: dateA,
        staff_id_b: staffIdB,
        date_b: dateB,
      });
      if (!res?.success) {
        throw new Error(res?.message || "Leave swap failed");
      }
      setSuccess(
        `Swap completed: ${staffALabel} now off ${dateB}, ${staffBLabel} now off ${dateA}.`
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Leave swap failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="leave-apply-form leave-swap-form" onSubmit={handleSubmit}>
      <p className="leave-apply-hint">
        Trade two off dates. Both days must be Monday–Thursday. Blackout and designation clash
        errors are shown below.
      </p>

      <div className="leave-swap-grid">
        <fieldset className="leave-swap-card">
          <legend>Staff A</legend>
          <label className="attendance-search-field">
            Employee
            <select value={staffIdA} onChange={(e) => setStaffIdA(e.target.value)}>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.label}
                </option>
              ))}
            </select>
          </label>
          <label className="attendance-search-field">
            Current off date
            <input type="date" value={dateA} onChange={(e) => handleDateA(e.target.value)} required />
          </label>
        </fieldset>

        <fieldset className="leave-swap-card">
          <legend>Staff B (peer)</legend>
          <label className="attendance-search-field">
            Employee
            <select value={staffIdB} onChange={(e) => setStaffIdB(e.target.value)}>
              {staffOptions.map((staff) => (
                <option key={`b-${staff.id}`} value={staff.id}>
                  {staff.label}
                </option>
              ))}
            </select>
          </label>
          <label className="attendance-search-field">
            Current off date
            <input type="date" value={dateB} onChange={(e) => handleDateB(e.target.value)} required />
          </label>
        </fieldset>
      </div>

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

      <button type="submit" className="user-primary-btn" disabled={busy || !canSwap || staffOptions.length < 2}>
        {busy ? "Swapping…" : "Swap leave dates"}
      </button>
    </form>
  );
}
