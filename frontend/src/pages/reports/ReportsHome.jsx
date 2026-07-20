import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import {
  BarChartCard,
  DoughnutChartCard,
  LineChartCard,
  chartColors,
  chartPalette,
} from "../../components/charts";
import KpiCard from "../../components/dashboard/KpiCard.jsx";
import MONTH_OPTIONS, { formatInr } from "../../utils/earningsFormat.js";
import "./ReportsHome.css";

function TrendText({ trend }) {
  if (!trend) return null;
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "•";
  return (
    <span className="reports-hero__trend">
      {arrow} {trend.percent}% {trend.label}
    </span>
  );
}

function InsightCard({ insight }) {
  return (
    <article className={`reports-insight reports-insight--${insight.type || "info"}`}>
      <span className="reports-insight__dot" aria-hidden="true" />
      <div>
        <strong>{insight.title}</strong>
        <p>{insight.body}</p>
      </div>
    </article>
  );
}

export default function ReportsHome() {
  const now = new Date();
  const [periodValue, setPeriodValue] = useState(
    (now.getFullYear() * 100 + (now.getMonth() + 1)).toString()
  );
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { month, year } = useMemo(() => {
    const v = Number(periodValue);
    return { year: Math.floor(v / 100), month: v % 100 };
  }, [periodValue]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await arnavApi.getOwnerReports({ month, year });
        if (!response.success) throw new Error(response.message || "Failed to load reports");
        if (!cancelled) setReports(response.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message || "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const revenueTrendChart = useMemo(() => {
    const trend = reports?.charts?.revenue_trend;
    if (!trend) return null;
    return {
      labels: trend.labels,
      datasets: [
        {
          label: "Revenue",
          data: trend.values,
          borderColor: chartColors.primary,
          backgroundColor: "rgba(20, 184, 166, 0.14)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [reports]);

  const bookingTrendChart = useMemo(() => {
    const trend = reports?.charts?.booking_trend;
    if (!trend) return null;
    return {
      labels: trend.labels,
      datasets: [
        {
          label: "Bookings",
          data: trend.values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [reports]);

  const paymentModeChart = useMemo(() => {
    const split = reports?.charts?.payment_mode_split;
    if (!split?.labels?.length) return null;
    return {
      labels: split.labels,
      datasets: [{ label: "Revenue", data: split.values }],
    };
  }, [reports]);

  const revenueCategoryChart = useMemo(() => {
    const split = reports?.charts?.revenue_by_category;
    if (!split?.labels?.length) return null;
    return {
      labels: split.labels,
      datasets: [
        {
          label: "Revenue",
          data: split.values,
          backgroundColor: chartPalette.slice(0, split.labels.length),
        },
      ],
    };
  }, [reports]);

  const bookingStatusChart = useMemo(() => {
    const breakdown = reports?.charts?.booking_status;
    if (!breakdown?.labels?.length) return null;
    return {
      labels: breakdown.labels,
      datasets: [{ label: "Bookings", data: breakdown.values }],
    };
  }, [reports]);

  const peakHoursChart = useMemo(() => {
    const peak = reports?.charts?.peak_hours;
    if (!peak) return null;
    return {
      labels: peak.labels,
      datasets: [
        {
          label: "Revenue",
          data: peak.values,
          backgroundColor: "rgba(26, 138, 130, 0.75)",
        },
      ],
    };
  }, [reports]);

  const weekdayChart = useMemo(() => {
    const load = reports?.charts?.weekday_load;
    if (!load) return null;
    return {
      labels: load.labels,
      datasets: [
        {
          label: "Bookings",
          data: load.values,
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    };
  }, [reports]);

  const executive = reports?.executive;

  return (
    <div className="page reports-page">
      <header className="page-header">
        <p className="app-eyebrow">Owner Intelligence</p>
        <h1>Reports</h1>
        <p className="page-description">
          Revenue, staff performance, retention, inventory health, and salon operations — all in one command center.
        </p>
      </header>

      <div className="reports-toolbar">
        <label className="reports-period-field">
          Report period
          <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)}>
            {MONTH_OPTIONS.map((opt) => (
              <option key={`${opt.year}-${opt.month}`} value={opt.year * 100 + opt.month}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/billing/invoices" className="quick-nav-link">
            Invoices →
          </Link>
          <Link to="/payroll" className="quick-nav-link">
            Payroll →
          </Link>
          <Link to="/inventory" className="quick-nav-link">
            Inventory →
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Generating owner reports…</p>
      ) : error ? (
        <p className="status-error">{error}</p>
      ) : !reports ? (
        <p className="page-note">No report data available.</p>
      ) : (
        <>
          <section className="reports-hero">
            <p className="reports-hero__eyebrow">{reports.period.label}</p>
            <h2 className="reports-hero__title">Salon performance snapshot</h2>
            <div className="reports-hero__grid">
              <div className="reports-hero__tile">
                <p className="reports-hero__label">Total Revenue</p>
                <p className="reports-hero__value">{formatInr(executive?.revenue?.value)}</p>
                <TrendText trend={executive?.revenue?.trend} />
              </div>
              <div className="reports-hero__tile">
                <p className="reports-hero__label">Invoices</p>
                <p className="reports-hero__value">{executive?.invoices?.count || 0}</p>
                <TrendText trend={executive?.invoices?.trend} />
              </div>
              <div className="reports-hero__tile">
                <p className="reports-hero__label">Avg Ticket</p>
                <p className="reports-hero__value">{formatInr(executive?.avg_ticket?.value)}</p>
                <TrendText trend={executive?.avg_ticket?.trend} />
              </div>
              <div className="reports-hero__tile">
                <p className="reports-hero__label">Customers Served</p>
                <p className="reports-hero__value">{executive?.customers_served || 0}</p>
                <span className="reports-hero__trend">Unique clients billed</span>
              </div>
            </div>
          </section>

          <section className="reports-kpi-grid">
            {(reports.kpis || []).map((kpi) => (
              <KpiCard
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                period={kpi.period}
                tone={kpi.tone}
                format={kpi.format}
                icon={kpi.icon}
                trend={kpi.trend}
                sparkline={kpi.sparkline}
              />
            ))}
          </section>

          {reports.insights?.length > 0 && (
            <section className="reports-section">
              <div className="reports-section__header">
                <h2>AI-style owner insights</h2>
                <span>Actionable signals from your live data</span>
              </div>
              <div className="reports-insights">
                {reports.insights.map((insight) => (
                  <InsightCard key={insight.title} insight={insight} />
                ))}
              </div>
            </section>
          )}

          <section className="reports-charts-grid">
            {revenueTrendChart && (
              <div className="reports-chart-wide">
                <LineChartCard
                  title="Daily revenue trend"
                  subtitle="Invoice grand totals by billing date"
                  labels={revenueTrendChart.labels}
                  datasets={revenueTrendChart.datasets}
                  height={320}
                />
              </div>
            )}
            {paymentModeChart && (
              <DoughnutChartCard
                title="Payment mode mix"
                subtitle="How clients are paying"
                labels={paymentModeChart.labels}
                datasets={paymentModeChart.datasets}
              />
            )}
            {revenueCategoryChart && (
              <BarChartCard
                title="Revenue by category"
                subtitle="Services vs retail vs packages"
                labels={revenueCategoryChart.labels}
                datasets={revenueCategoryChart.datasets}
              />
            )}
            {bookingTrendChart && (
              <div className="reports-chart-wide">
                <LineChartCard
                  title="Daily booking volume"
                  subtitle="Appointment load across the month"
                  labels={bookingTrendChart.labels}
                  datasets={bookingTrendChart.datasets}
                  height={320}
                />
              </div>
            )}
            {bookingStatusChart && (
              <DoughnutChartCard
                title="Booking outcomes"
                subtitle="Completed, cancelled, no-shows"
                labels={bookingStatusChart.labels}
                datasets={bookingStatusChart.datasets}
              />
            )}
            {peakHoursChart && (
              <BarChartCard
                title="Peak revenue hours"
                subtitle="When the salon earns the most"
                labels={peakHoursChart.labels}
                datasets={peakHoursChart.datasets}
              />
            )}
            {weekdayChart && (
              <BarChartCard
                title="Busiest weekdays"
                subtitle="Booking distribution by day"
                labels={weekdayChart.labels}
                datasets={weekdayChart.datasets}
              />
            )}
          </section>

          <section className="reports-two-col">
            <div className="reports-section">
              <div className="reports-section__header">
                <h2>Staff leaderboard</h2>
                <span>Sales & commission</span>
              </div>
              <div className="reports-table-wrap">
                <table className="reports-data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stylist</th>
                      <th>Designation</th>
                      <th>Sales</th>
                      <th>Commission</th>
                      <th>Services</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.staff_leaderboard || []).map((row) => (
                      <tr key={row.staff_id}>
                        <td>
                          <span className={`reports-rank ${row.rank <= 3 ? "is-top" : ""}`}>{row.rank}</span>
                        </td>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.designation}</td>
                        <td>{formatInr(row.sales)}</td>
                        <td>{formatInr(row.commission)}</td>
                        <td>{row.services_count}</td>
                      </tr>
                    ))}
                    {!reports.staff_leaderboard?.length && (
                      <tr>
                        <td colSpan={6}>No commission data for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="reports-section">
              <div className="reports-section__header">
                <h2>Top services</h2>
                <span>By billed revenue</span>
              </div>
              <div className="reports-table-wrap">
                <table className="reports-data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Revenue</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.top_services || []).map((row) => (
                      <tr key={row.name}>
                        <td><strong>{row.name}</strong></td>
                        <td>{formatInr(row.revenue)}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                    {!reports.top_services?.length && (
                      <tr>
                        <td colSpan={3}>No service revenue recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="reports-section">
            <div className="reports-section__header">
              <h2>Top customers</h2>
              <span>Highest spenders this period</span>
            </div>
            <div className="reports-table-wrap">
              <table className="reports-data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Total Spend</th>
                    <th>Visits</th>
                    <th>Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports.top_customers || []).map((row) => (
                    <tr key={row.customer_id}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.phone}</td>
                      <td>{formatInr(row.total_spend)}</td>
                      <td>{row.visits}</td>
                      <td>
                        {row.last_visit
                          ? new Date(row.last_visit).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {!reports.top_customers?.length && (
                    <tr>
                      <td colSpan={5}>No customer billing data for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="reports-section">
            <div className="reports-section__header">
              <h2>Customer retention</h2>
              <span>Lifetime & win-back metrics</span>
            </div>
            <div className="reports-mini-grid">
              <div className="reports-mini-card">
                <span>Total customers</span>
                <strong>{reports.retention?.total_customers || 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>New this period</span>
                <strong>{reports.retention?.new_this_period || 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Repeat clients</span>
                <strong>{reports.retention?.repeat_customers || 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Repeat rate</span>
                <strong>{reports.retention?.repeat_rate || 0}%</strong>
              </div>
              <div className="reports-mini-card">
                <span>Inactive 90+ days</span>
                <strong>{reports.retention?.inactive_90_days || 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>At-risk 30–90 days</span>
                <strong>{reports.retention?.at_risk_30_days || 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Outstanding dues</span>
                <strong>{formatInr(executive?.outstanding)}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Discounts given</span>
                <strong>{formatInr(executive?.discount_given)}</strong>
              </div>
            </div>
          </section>

          <section className="reports-two-col">
            <div className="reports-section">
              <div className="reports-section__header">
                <h2>Attendance snapshot</h2>
                <span>{reports.attendance_snapshot?.staff_count || 0} active staff</span>
              </div>
              <div className="reports-mini-grid" style={{ marginBottom: "0.85rem" }}>
                <div className="reports-mini-card">
                  <span>Avg attendance</span>
                  <strong>{reports.attendance_snapshot?.avg_attendance_rate || 0}%</strong>
                </div>
                <div className="reports-mini-card">
                  <span>Total payable days</span>
                  <strong>{reports.attendance_snapshot?.total_payable_days || 0}</strong>
                </div>
              </div>
              <div className="reports-table-wrap">
                <table className="reports-data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.attendance_snapshot?.top_performers || []).slice(0, 5).map((row) => (
                      <tr key={row.staff_id}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.present}</td>
                        <td>{row.late}</td>
                        <td>{row.attendance_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="reports-section">
              <div className="reports-section__header">
                <h2>Packages & inventory</h2>
                <span>Retail & prepaid health</span>
              </div>
              <div className="reports-mini-grid" style={{ marginBottom: "0.85rem" }}>
                <div className="reports-mini-card">
                  <span>Active packages</span>
                  <strong>{reports.packages_snapshot?.active_count || 0}</strong>
                </div>
                <div className="reports-mini-card">
                  <span>Expiring soon</span>
                  <strong>{reports.packages_snapshot?.expiring_soon || 0}</strong>
                </div>
                <div className="reports-mini-card">
                  <span>Package revenue</span>
                  <strong>{formatInr(reports.packages_snapshot?.revenue_this_period)}</strong>
                </div>
                <div className="reports-mini-card">
                  <span>Stock value</span>
                  <strong>{formatInr(reports.inventory_snapshot?.stock_value_sale)}</strong>
                </div>
              </div>
              <div className="reports-alert-list">
                {(reports.inventory_snapshot?.reorder_alerts || []).slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`reports-alert-item ${alert.status === "out_of_stock" ? "critical" : ""}`}
                  >
                    <div>
                      <strong>{alert.name}</strong>
                      <span>SKU {alert.sku}</span>
                    </div>
                    <span>{alert.current_stock} left</span>
                  </div>
                ))}
                {!reports.inventory_snapshot?.reorder_alerts?.length && (
                  <p className="page-note" style={{ margin: 0 }}>All products are above reorder levels.</p>
                )}
              </div>
            </div>
          </section>

          <p className="reports-generated">
            Generated {reports.generated_at ? new Date(reports.generated_at).toLocaleString("en-IN") : "just now"}
          </p>
        </>
      )}
    </div>
  );
}
