import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import {
  BarChartCard,
  DoughnutChartCard,
  LineChartCard,
  chartColors,
  chartPalette,
} from "../../components/charts";
import KpiCard from "../../components/dashboard/KpiCard.jsx";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning ,";
  if (hour < 17) return "Good afternoon ,";
  return "Good evening ,";
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const { user, hasPermission } = usePermission();
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
          backgroundColor: "rgba(15, 118, 110, 0.12)",
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
          data: split.values,
          backgroundColor: chartPalette,
          borderWidth: 0,
        },
      ],
    };
  }, [dashboard]);

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-hero__eyebrow">{getGreeting()}</p>
          <h1 className="dashboard-hero__title">{user?.name || "Welcome"}</h1>
          <p className="dashboard-hero__subtitle">
            {isOwnerView
              ? "Salon operations overview — bookings, stock, customers, and team activity."
              : "Your schedule and earnings snapshot for the week ahead."}
          </p>
        </div>

        <div className="dashboard-hero__meta">
          <span className="dashboard-hero__badge">
            {isOwnerView ? "Owner view" : "Staff view"}
          </span>
          {dashboard?.updated_at ? (
            <span className="dashboard-hero__updated">
              Updated{" "}
              {new Date(dashboard.updated_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
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
                hint={kpi.hint}
                tone={kpi.tone}
                format={kpi.format}
              />
            ))}
          </section>

          <section className="dashboard-panels">
            {bookingTrend ? (
              <LineChartCard
                title={isOwnerView ? "Booking trend (7 days)" : "My appointments (7 days)"}
                labels={bookingTrend.labels}
                datasets={bookingTrend.datasets}
              />
            ) : null}

            {isOwnerView && serviceSplit ? (
              <BarChartCard
                title="Top services (30 days)"
                labels={serviceSplit.labels}
                datasets={serviceSplit.datasets}
              />
            ) : null}

            {!isOwnerView && dashboard.next_booking ? (
              <article className="dashboard-panel-card">
                <h2>Next appointment</h2>
                <p className="dashboard-panel-card__value">
                  {dashboard.next_booking.customer_name}
                </p>
                <p className="dashboard-panel-card__meta">
                  {dashboard.next_booking.service_label}
                </p>
                <p className="dashboard-panel-card__meta">
                  {formatDateTime(dashboard.next_booking.start_time)}
                </p>
                <Link to="/staff/my-calendar" className="dashboard-panel-card__link">
                  Open my calendar
                </Link>
              </article>
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
            ) : (
              <DoughnutChartCard
                title="Operations mix"
                labels={["Bookings", "Customers", "Staff"]}
                datasets={[
                  {
                    data: [
                      dashboard.kpis.find((kpi) => kpi.key === "todays_bookings")
                        ?.value || 0,
                      dashboard.kpis.find((kpi) => kpi.key === "customers")?.value ||
                        0,
                      dashboard.kpis.find((kpi) => kpi.key === "active_staff")
                        ?.value || 0,
                    ],
                    backgroundColor: [
                      chartColors.primary,
                      chartColors.secondary,
                      "#f59e0b",
                    ],
                    borderWidth: 0,
                  },
                ]}
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
