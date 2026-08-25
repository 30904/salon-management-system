import { useEffect, useMemo, useState } from "react";
import { staffApi } from "../api/index.js";
import MonthlyTargetsCard from "../components/MonthlyTargetsCard.jsx";
import { MONTH_OPTIONS, formatDateTime, formatInr, formatDeductionInr, formatPeriodLabel } from "../utils/format.js";

export default function Earnings() {
  const [period, setPeriod] = useState(MONTH_OPTIONS[0]);
  const [data, setData] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [earningsRes, targetsRes] = await Promise.all([
          staffApi.getMyEarnings({ month: period.month, year: period.year }),
          staffApi.getMyTargets({ month: period.month, year: period.year }),
        ]);

        if (!earningsRes.success) throw new Error(earningsRes.message || "Failed to load earnings");

        const staffId = earningsRes.data?.staff?.id;
        let payslipPayload = null;
        if (staffId) {
          const payslipRes = await staffApi.getStaffPayslip(staffId, {
            month: period.month,
            year: period.year,
          });
          if (!payslipRes.success) throw new Error(payslipRes.message || "Failed to load payslip");
          payslipPayload = payslipRes.data;
        }

        if (!cancelled) {
          setData(earningsRes.data);
          setPayslip(payslipPayload);
          setTargets(targetsRes.success ? targetsRes.data : null);
        }
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
  const slip = payslip?.entry;
  const run = payslip?.run;

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
          <MonthlyTargetsCard targets={targets} title="Sales targets" />

          <section className="stat-grid">
            <div className="stat-tile">
              <p className="card-label">Net payable</p>
              <strong>{slip ? formatInr(slip.net_payable) : "—"}</strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Base salary</p>
              <strong>{formatInr(slip?.base_salary ?? staff.base_salary)}</strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Unpaid-day deduction</p>
              <strong>{slip ? formatDeductionInr(slip.deduction_amount) : "—"}</strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Redo product cost deduction</p>
              <strong>
                {slip ? formatDeductionInr(slip.redo_product_cost_deduction || 0) : "—"}
              </strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Commission</p>
              <strong>{formatInr(slip?.commission_total ?? summary?.commission_total)}</strong>
            </div>
          </section>

          {slip ? (
            <section className="status-card">
              <p className="card-label">Payslip breakdown</p>
              <ul className="entry-list" style={{ margin: "0.5rem 0 0" }}>
                <li className="entry-card">
                  <span>Base salary</span>
                  <strong>{formatInr(slip.base_salary)}</strong>
                </li>
                <li className="entry-card">
                  <span>Unpaid-day deduction</span>
                  <strong>{formatDeductionInr(slip.deduction_amount)}</strong>
                </li>
                <li className="entry-card">
                  <span>Redo product cost deduction</span>
                  <strong>{formatDeductionInr(slip.redo_product_cost_deduction || 0)}</strong>
                </li>
                <li className="entry-card">
                  <span>Commission</span>
                  <strong>{formatInr(slip.commission_total)}</strong>
                </li>
                <li className="entry-card">
                  <span>Net payable</span>
                  <strong>{formatInr(slip.net_payable)}</strong>
                </li>
              </ul>
            </section>
          ) : null}

          <section className="status-card">
            <p className="card-label">Payroll</p>
            <p>
              {run
                ? `${run.status === "finalized" ? "Finalized" : "Draft"} · unpaid ${slip?.unpaid_days ?? 0} day(s)`
                : `No payroll run for ${periodLabel} yet.`}
            </p>
            <p className="muted">
              Service sales {formatInr(summary?.sales_total)}. Net = base − unpaid deduction − redo
              product cost + commission.
            </p>
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
