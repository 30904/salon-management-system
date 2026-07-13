import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import {
  BarChartCard,
  DoughnutChartCard,
  LineChartCard,
  chartColors,
} from "../../components/charts";
import KpiCard from "../../components/dashboard/KpiCard.jsx";
import UpcomingAppointmentsCard from "../../components/dashboard/UpcomingAppointmentsCard.jsx";
import NeedsAttentionCard from "../../components/dashboard/NeedsAttentionCard.jsx";

export default function Dashboard() {
  const { hasPermission } = usePermission();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isOwnerView = hasPermission("billing", "view");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await arnavApi.getDashboard();

        if (!response.success) {
          throw new Error(response.message || "Failed to load dashboard");
        }

        if (!cancelled) {
          setDashboard(response.data);
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
  }, []);

  const bookingTrend = useMemo(() => {
    const trend = dashboard?.charts?.booking_trend;

    if (!trend) {
      return null;
    }

    return {
      labels: trend.labels,
      datasets: [
        {
          label: isOwnerView ? "Bookings" : "My appointments",
          data: trend.values,
          borderColor: chartColors.primary,
          backgroundColor: "rgba(20, 184, 166, 0.14)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [dashboard, isOwnerView]);

  const serviceSplit = useMemo(() => {
    const split = dashboard?.charts?.service_split;

    if (!split || !split.labels?.length) {
      return null;
    }

    return {
      labels: split.labels,
      datasets: [
        {
          label: "Services",
          data: split.values,
        },
      ],
    };
  }, [dashboard]);

  const bookingStatusBreakdown = useMemo(() => {
    const breakdown = dashboard?.charts?.booking_status_breakdown;

    if (!breakdown || !breakdown.labels?.length) {
      return null;
    }

    return {
      labels: breakdown.labels,
      datasets: [
        {
          label: "Bookings",
          data: breakdown.values,
          backgroundColor: [
            "#3b82f6",
            "#f59e0b",
            "#0f766e",
            "#ef4444",
            "#94a3b8",
          ],
        },
      ],
    };
  }, [dashboard]);

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero dashboard-hero--empty" aria-hidden="true">
        <div className="dashboard-hero__placeholder">
          <p className="dashboard-hero__eyebrow">Good afternoon ,</p>
          <h1 className="dashboard-hero__title">Salon Owner</h1>
        </div>
      </section>

      {loading ? <p className="dashboard-status">Loading dashboard metrics…</p> : null}
      {error ? <p className="dashboard-status dashboard-status--error">{error}</p> : null}

      {!loading && !error && dashboard ? (
        <>
          <section className="kpi-grid" aria-label="Key metrics">
            {dashboard.kpis.map((kpi) => (
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

          <section className="dashboard-panels">
            {bookingTrend ? (
              <div className="dashboard-panels__trend-row">
                <div className="dashboard-panels__trend-main">
                  <LineChartCard
                    title={isOwnerView ? "Booking trend (7 days)" : "My appointments (7 days)"}
                    subtitle={isOwnerView ? "Daily booking volume" : "Your weekly schedule"}
                    labels={bookingTrend.labels}
                    datasets={bookingTrend.datasets}
                    height={320}
                  />
                </div>

                <div className="dashboard-panels__trend-side">
                  <UpcomingAppointmentsCard
                    appointments={dashboard.panels?.upcoming_appointments || []}
                    subtitle={
                      isOwnerView ? "Next scheduled visits" : "Your upcoming schedule"
                    }
                  />

                  <NeedsAttentionCard
                    needsAttention={dashboard.panels?.needs_attention}
                    subtitle={
                      isOwnerView
                        ? "Low stock and booking issues"
                        : "Cancelled and missed appointments"
                    }
                  />
                </div>
              </div>
            ) : null}

            {isOwnerView && (serviceSplit || bookingStatusBreakdown) ? (
              <div className="dashboard-panels__duo">
                {serviceSplit ? (
                  <BarChartCard
                    title="Top services (30 days)"
                    subtitle="Most booked salon services"
                    labels={serviceSplit.labels}
                    datasets={serviceSplit.datasets}
                  />
                ) : null}

                {bookingStatusBreakdown ? (
                  <DoughnutChartCard
                    title="Booking status breakdown"
                    subtitle="Last 7 days"
                    labels={bookingStatusBreakdown.labels}
                    datasets={bookingStatusBreakdown.datasets}
                  />
                ) : null}
              </div>
            ) : null}

            {!isOwnerView ? (
              <article className="dashboard-panel-card">
                <h2>Quick links</h2>
                <div className="dashboard-quick-links">
                  <Link to="/staff/my-calendar">My calendar</Link>
                  <Link to="/staff/my-earnings">My earnings</Link>
                  <Link to="/attendance">Attendance</Link>
                </div>
              </article>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
