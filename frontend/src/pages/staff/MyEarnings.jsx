import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import MONTH_OPTIONS, {
  formatDateTime,
  formatInr,
  formatPeriodLabel,
} from "../../utils/earningsFormat.js";

export default function MyEarnings() {
  const { user } = usePermission();
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
        const response = await arnavApi.getMyEarnings({
          month: period.month,
          year: period.year,
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to load earnings");
        }

        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [period.month, period.year]);

  const periodLabel = useMemo(
    () => formatPeriodLabel(period.month, period.year),
    [period.month, period.year]
  );

  const summary = data?.summary;
  const entries = data?.entries || [];
  const staff = data?.staff;

  return (
    <div className="page my-earnings-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Staff Portal</p>
          <h1>My earnings</h1>
          <p className="page-description">
            Commission accrued from your serviced invoice lines for{" "}
            <strong>{user?.name || "your account"}</strong>.
          </p>
        </div>

        <label className="my-earnings-period-filter">
          Period
          <select
            value={`${period.year}-${period.month}`}
            onChange={(event) => {
              const selected = MONTH_OPTIONS.find(
                (option) => `${option.year}-${option.month}` === event.target.value
              );
              if (selected) {
                setPeriod(selected);
              }
            }}
          >
            {MONTH_OPTIONS.map((option) => (
              <option
                key={`${option.year}-${option.month}`}
                value={`${option.year}-${option.month}`}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && <p>Loading earnings…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && !staff && (
        <section className="status-card">
          <h2>No staff profile linked</h2>
          <p className="page-note">
            Your login is active, but no StaffProfile is linked yet. Ask your
            manager to link your user account in Staff Master.
          </p>
        </section>
      )}

      {!loading && !error && staff && (
        <>
          <section className="user-summary-row">
            <div className="user-summary-card">
              <span className="user-summary-label">{periodLabel} commission</span>
              <strong>{formatInr(summary?.commission_total)}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Service sales</span>
              <strong>{formatInr(summary?.sales_total)}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Entries</span>
              <strong>{summary?.entry_count || 0}</strong>
            </div>
          </section>

          <section className="status-card my-earnings-meta-card">
            <div>
              <p className="user-summary-label">Designation</p>
              <strong>{staff.designation || "—"}</strong>
            </div>
            <div>
              <p className="user-summary-label">Base salary</p>
              <strong>{formatInr(staff.base_salary)}</strong>
            </div>
            <div>
              <p className="user-summary-label">Specialization</p>
              <strong>
                {staff.specialization?.length
                  ? staff.specialization.join(", ")
                  : "—"}
              </strong>
            </div>
          </section>

          <p className="page-note my-earnings-note">
            Month-end threshold bonuses are calculated during payroll runs. This
            view shows per-line commission accruals only.
          </p>

          <section className="status-card user-table-card">
            {entries.length === 0 ? (
              <p className="page-note">No commission entries for {periodLabel}.</p>
            ) : (
              <div className="user-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Service</th>
                      <th>Invoice</th>
                      <th>Line amount</th>
                      <th>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.calculated_at)}</td>
                        <td>{entry.service_label || "Service line"}</td>
                        <td>{entry.invoice_reference || "—"}</td>
                        <td>{formatInr(entry.line_amount)}</td>
                        <td>{formatInr(entry.commission_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
