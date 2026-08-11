import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import { formatInr, formatPeriodLabel } from "../../utils/earningsFormat.js";

function currentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthValue(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  return { year, month };
}

function runStorageKey(month, year) {
  return `payrollRun:${year}-${String(month).padStart(2, "0")}`;
}

function formatRate(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RunPayroll() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("payroll", "view");

  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [run, setRun] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { year, month } = parseMonthValue(monthValue);
  const periodLabel = year && month ? formatPeriodLabel(month, year) : "";
  const isFinalized = run?.status === "finalized";

  const applyPayload = useCallback((payload) => {
    setRun(payload?.run || null);
    setEntries(payload?.entries || []);
    const runId = payload?.run?.id;
    if (runId && payload?.run?.month && payload?.run?.year) {
      sessionStorage.setItem(runStorageKey(payload.run.month, payload.run.year), String(runId));
    }
  }, []);

  const loadStoredRun = useCallback(async () => {
    if (!year || !month) return;

    const storedId = sessionStorage.getItem(runStorageKey(month, year));
    if (!storedId) {
      setRun(null);
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await arnavApi.getPayrollRun(storedId);
      if (!response.success) throw new Error(response.message || "Failed to load payroll run");
      applyPayload(response.data);
    } catch (err) {
      sessionStorage.removeItem(runStorageKey(month, year));
      setRun(null);
      setEntries([]);
      const status = err.response?.status;
      if (status !== 404) {
        setError(err.response?.data?.message || err.message || "Failed to load payroll run");
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload, month, year]);

  useEffect(() => {
    setNotice("");
    loadStoredRun();
  }, [loadStoredRun]);

  async function handleGenerate(event) {
    event.preventDefault();
    if (!year || !month) {
      setError("Select a month.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await arnavApi.runPayroll({ month, year });
      if (!response.success) throw new Error(response.message || "Failed to generate payroll");

      const runId = response.data?.run?.id;
      if (runId) {
        const detailed = await arnavApi.getPayrollRun(runId);
        if (detailed.success) {
          applyPayload(detailed.data);
        } else {
          applyPayload(response.data);
        }
      } else {
        applyPayload(response.data);
      }
      setNotice(`Draft calculated for ${periodLabel}.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to generate payroll");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!run?.id || isFinalized) return;
    const confirmed = window.confirm(
      `Finalize payroll for ${periodLabel}? The run cannot be recalculated after this.`
    );
    if (!confirmed) return;

    setFinalizing(true);
    setError("");
    setNotice("");
    try {
      const response = await arnavApi.finalizePayrollRun(run.id);
      if (!response.success) throw new Error(response.message || "Failed to finalize payroll");

      const detailed = await arnavApi.getPayrollRun(run.id);
      if (detailed.success) {
        applyPayload(detailed.data);
      } else {
        setRun(response.data);
      }
      setNotice(`Payroll for ${periodLabel} is finalized.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to finalize payroll");
    } finally {
      setFinalizing(false);
    }
  }

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.base += Number(entry.base_salary || 0);
        acc.deduction += Number(entry.deduction_amount || 0);
        acc.commission += Number(entry.commission_total || 0);
        acc.net += Number(entry.net_payable || 0);
        return acc;
      },
      { base: 0, deduction: 0, commission: 0, net: 0 }
    );
  }, [entries]);

  return (
    <div className="page tax-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Payroll</p>
          <h1>Run payroll</h1>
          <p className="page-description">
            Generate a draft, review net payable, then lock the month.
          </p>
        </div>
        <div className="user-permissions-header-actions">
          <Link to="/payroll" className="user-secondary-btn">
            Back to payroll
          </Link>
        </div>
      </header>

      {notice ? <p className="user-success-text">{notice}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      <form className="service-filter-bar" onSubmit={handleGenerate}>
        <label className="service-filter-select">
          Month
          <input
            type="month"
            value={monthValue}
            onChange={(event) => setMonthValue(event.target.value)}
          />
        </label>
        {canManage ? (
          <button type="submit" className="user-primary-btn" disabled={saving || isFinalized}>
            {saving ? "Calculating…" : isFinalized ? "Already finalized" : "Generate draft"}
          </button>
        ) : null}
        {run && canManage ? (
          <button
            type="button"
            className="user-secondary-btn"
            onClick={handleFinalize}
            disabled={finalizing || isFinalized}
          >
            {finalizing ? "Finalizing…" : isFinalized ? "Finalized" : "Finalize run"}
          </button>
        ) : null}
      </form>

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Period</span>
          <strong>{periodLabel || "—"}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Status</span>
          <strong>
            {run ? (
              <span className={`user-status-pill ${isFinalized ? "active" : "inactive"}`}>
                {isFinalized ? "Finalized" : "Draft"}
              </span>
            ) : (
              "—"
            )}
          </strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Staff entries</span>
          <strong>{loading ? "…" : entries.length}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Total net</span>
          <strong>{loading ? "…" : formatInr(totals.net)}</strong>
        </div>
      </section>

      <section className="status-card user-table-card">
        {loading ? <p>Loading payroll run…</p> : null}

        {!loading && !run ? (
          <p className="page-note">
            No run loaded for {periodLabel || "this month"}. Generate a draft to calculate entries.
          </p>
        ) : null}

        {!loading && run && entries.length === 0 ? (
          <p className="page-note">No staff entries for this run.</p>
        ) : null}

        {!loading && entries.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Designation</th>
                  <th>Base</th>
                  <th>Working days</th>
                  <th>Payable</th>
                  <th>Unpaid</th>
                  <th>Per day</th>
                  <th>Deduction</th>
                  <th>Commission</th>
                  <th>Net payable</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.staff_name || "Staff"}</strong>
                    </td>
                    <td>{entry.designation || "—"}</td>
                    <td>{formatInr(entry.base_salary)}</td>
                    <td>{entry.working_days_in_month}</td>
                    <td>{entry.payable_days}</td>
                    <td>{entry.unpaid_days}</td>
                    <td>{formatRate(entry.per_day_rate)}</td>
                    <td>{formatInr(entry.deduction_amount)}</td>
                    <td>{formatInr(entry.commission_total)}</td>
                    <td>
                      <strong>{formatInr(entry.net_payable)}</strong>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7}>
                    <strong>Totals</strong>
                  </td>
                  <td>
                    <strong>{formatInr(totals.deduction)}</strong>
                  </td>
                  <td>
                    <strong>{formatInr(totals.commission)}</strong>
                  </td>
                  <td>
                    <strong>{formatInr(totals.net)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
