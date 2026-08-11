import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

function currentMonthValue() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthValue(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  return { year, month };
}

function formatHolidayDate(value) {
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

export default function HolidayList() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("settings", "create");

  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadHolidays = useCallback(async () => {
    const { year, month } = parseMonthValue(monthValue);
    if (!year || !month) return;

    setLoading(true);
    setError("");
    try {
      const response = await arnavApi.listHolidays({ month, year });
      if (!response.success) throw new Error(response.message || "Failed to load holidays");
      setHolidays(response.data?.holidays || []);
    } catch (err) {
      setHolidays([]);
      setError(err.response?.data?.message || err.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!name.trim() || !date) {
      setError("Name and date are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await arnavApi.createHoliday({ name: name.trim(), date });
      if (!response.success) throw new Error(response.message || "Failed to add holiday");

      const createdMonth = String(date).slice(0, 7);
      setName("");
      setDate("");
      setNotice(`Added ${response.data?.name || name.trim()}.`);
      if (createdMonth && createdMonth !== monthValue) {
        setMonthValue(createdMonth);
      } else {
        await loadHolidays();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page holiday-list-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Holidays</h1>
          <p>
            Company holiday dates used by attendance summary and payroll working days.
          </p>
        </div>
        <div className="module-hero-actions">
          <Link to="/settings" className="module-hero-btn">
            Back to settings
          </Link>
        </div>
      </header>

      {notice ? <p className="user-success-text">{notice}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      {canCreate ? (
        <form className="module-panel service-category-form" onSubmit={handleCreate}>
          <label>
            Holiday name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Independence Day"
              maxLength={120}
              required
            />
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <button type="submit" className="user-primary-btn user-primary-btn--hero" disabled={saving}>
            {saving ? "Adding…" : "Add holiday"}
          </button>
        </form>
      ) : null}

      <div className="module-panel service-filter-bar">
        <label className="service-filter-select">
          Month
          <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
        </label>
        <button type="button" className="user-secondary-btn" onClick={loadHolidays} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Holidays this month</span>
          <strong>{loading ? "…" : holidays.length}</strong>
        </div>
      </section>

      <section className="status-card user-table-card">
        {loading ? <p>Loading holidays…</p> : null}

        {!loading && holidays.length === 0 ? (
          <p className="page-note">No holidays for this month.</p>
        ) : null}

        {!loading && holidays.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id}>
                    <td>{formatHolidayDate(holiday.date)}</td>
                    <td>
                      <strong>{holiday.name}</strong>
                    </td>
                    <td>{holiday.branch_id ? "Branch" : "All branches"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
