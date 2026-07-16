import { useEffect, useMemo, useState } from "react";
import { preciousApi } from "../../api";
import MONTH_OPTIONS, {
  formatInr,
  formatPeriodLabel,
} from "../../utils/earningsFormat.js";
import { usePermission } from "../../hooks/usePermission.js";

export default function PayrollHome() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("payroll", "view");

  const [period, setPeriod] = useState(MONTH_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payrollSummaries, setPayrollSummaries] = useState([]);

  const [q, setQ] = useState("");

  const loadPayrollDummy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await preciousApi.getAttendanceSummary({
        month: period.month,
        year: period.year,
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to load payroll dummy");
      }

      setPayrollSummaries(res.data?.payroll_summaries || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed");
      setPayrollSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollDummy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.month, period.year]);

  const totals = useMemo(() => {
    const staffCount = payrollSummaries.length;
    const totalPayableDays = payrollSummaries.reduce(
      (sum, s) => sum + Number(s.payable_days || 0),
      0
    );
    const totalHours = payrollSummaries.reduce(
      (sum, s) => sum + Number(s.total_hours_worked || 0),
      0
    );

    const totalBaseSalaries = payrollSummaries.reduce(
      (sum, s) => sum + Number(s.base_salary || 0),
      0
    );

    return { staffCount, totalPayableDays, totalHours, totalBaseSalaries };
  }, [payrollSummaries]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return payrollSummaries;
    return payrollSummaries.filter((s) => {
      const name = s.user?.name || "";
      const des = s.designation || "";
      return name.toLowerCase().includes(term) || des.toLowerCase().includes(term);
    });
  }, [payrollSummaries, q]);

  if (!canView) {
    return (
      <div className="page access-denied-page">
        <div className="access-denied-card">
          <h1>Access denied</h1>
          <p className="page-note">You don’t have permission to view payroll.</p>
        </div>
      </div>
    );
  }

  const periodLabel = formatPeriodLabel(period.month, period.year);

  return (
    <div className="page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Payroll</p>
          <h1>Payroll runs</h1>
          {/* <p className="page-description">
            Prototype screen using attendance summary to approximate payable days.
          </p> */}
        </div>

        <label className="my-earnings-period-filter">
          Period
          <select
            value={`${period.year}-${period.month}`}
            onChange={(e) => {
              const selected = MONTH_OPTIONS.find(
                (option) => `${option.year}-${option.month}` === e.target.value
              );
              if (selected) setPeriod(selected);
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

      {loading && <p>Loading payroll dummy…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="user-summary-row">
            <div className="user-summary-card">
              <span className="user-summary-label">Shown period</span>
              <strong>{periodLabel}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Staff</span>
              <strong>{totals.staffCount}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Payable days</span>
              <strong>{totals.totalPayableDays}</strong>
            </div>
          </section>

          <section className="status-card user-table-card">
            <div className="user-permissions-toolbar" style={{ padding: "0 0 1rem" }}>
              {/* <div className="user-permissions-filter">
                <strong style={{ color: "#111827" }}>Search staff</strong>
              </div> */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search by name/designation…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{
                    padding: "0.55rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.875rem",
                    width: 280,
                  }}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="page-note">No payroll rows match your search.</p>
            ) : (
              <div className="user-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Designation</th>
                      <th>Base salary</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Half Day</th>
                      <th>Absent</th>
                      <th>Payable days</th>
                      <th>Total hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.staff_id}>
                        <td>
                          <div className="user-name-cell">
                            <strong>{s.user?.name || "—"}</strong>
                            <span className="user-meta-text">{s.user?.email || "—"}</span>
                          </div>
                        </td>
                        <td>{s.designation || "—"}</td>
                        <td>{formatInr(s.base_salary)}</td>
                        <td>{s.days_present || 0}</td>
                        <td>{s.days_late || 0}</td>
                        <td>{s.days_half_day || 0}</td>
                        <td>{s.days_absent || 0}</td>
                        <td>
                          <strong>{s.payable_days || 0}</strong>
                        </td>
                        <td>{Number(s.total_hours_worked || 0).toFixed(2)}</td>
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
