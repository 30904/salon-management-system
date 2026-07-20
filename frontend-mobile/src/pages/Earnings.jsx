import { useEffect, useMemo, useState } from "react";
import { staffApi } from "../api/index.js";
import { MONTH_OPTIONS, formatDateTime, formatInr, formatPeriodLabel } from "../utils/format.js";

export default function Earnings() {
  const [period, setPeriod] = useState(MONTH_OPTIONS[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await staffApi.getMyEarnings({ month: period.month, year: period.year });
        if (!res.success) throw new Error(res.message || "Failed to load earnings");
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [period.month, period.year]);

  const periodLabel = useMemo(() => formatPeriodLabel(period.month, period.year), [period]);
  const staff = data?.staff;
  const summary = data?.summary;
  const entries = data?.entries || [];

  return (
    <div className="page-pad">
      <header className="page-header-row">
        <h1>My Collections</h1>
        <select
          value={`${period.year}-${period.month}`}
          onChange={(e) => {
            const selected = MONTH_OPTIONS.find((o) => `${o.year}-${o.month}` === e.target.value);
            if (selected) setPeriod(selected);
          }}
        >
          {MONTH_OPTIONS.map((option) => (
            <option key={`${option.year}-${option.month}`} value={`${option.year}-${option.month}`}>
              {option.label}
            </option>
          ))}
        </select>
      </header>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && !staff && (
        <section className="status-card">
          <p className="muted">
            No staff profile linked to your account yet. Ask your manager to link it in Staff Master.
          </p>
        </section>
      )}

      {!loading && !error && staff && (
        <>
          <section className="stat-row">
            <div className="stat-tile">
              <p className="card-label">{periodLabel} commission</p>
              <strong>{formatInr(summary?.commission_total)}</strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Service sales</p>
              <strong>{formatInr(summary?.sales_total)}</strong>
            </div>
          </section>

          <section className="status-card">
            <p className="card-label">Base salary</p>
            <strong>{formatInr(staff.base_salary)}</strong>
          </section>

          <h2 className="section-title">Entries</h2>
          {entries.length === 0 ? (
            <p className="muted">No commission entries for {periodLabel}.</p>
          ) : (
            <ul className="entry-list">
              {entries.map((entry) => (
                <li key={entry.id} className="entry-card">
                  <div>
                    <strong>{entry.service_label || "Service line"}</strong>
                    <p className="muted">{formatDateTime(entry.calculated_at)}</p>
                    <p className="muted">{entry.invoice_reference || "—"}</p>
                  </div>
                  <div className="entry-amounts">
                    <span>{formatInr(entry.line_amount)}</span>
                    <strong>{formatInr(entry.commission_amount)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
