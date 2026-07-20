import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { attendanceApi, dashboardApi } from "../api/index.js";
import InstallAppCard from "../components/InstallAppCard.jsx";
import { usePermission } from "../hooks/usePermission.js";
import { formatInr, formatTime } from "../utils/format.js";

function greet() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user, isOwner } = usePermission();
  const [dashboard, setDashboard] = useState(null);
  const [punchStatus, setPunchStatus] = useState(null);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, statusRes] = await Promise.all([
          dashboardApi.getDashboard(),
          attendanceApi.getAttendanceStatus().catch(() => null),
        ]);

        if (cancelled) return;
        if (!dashRes.success) throw new Error(dashRes.message || "Failed to load dashboard");

        setDashboard(dashRes.data);
        setPunchStatus(statusRes?.data || null);

        if (isOwner) {
          const todayRes = await attendanceApi.getAttendanceToday();
          if (!cancelled) setToday(todayRes?.data || null);
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
  }, [isOwner]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (error) return <div className="page-pad"><p className="form-error">{error}</p></div>;

  return (
    <div className="page-pad">
      <header className="home-header">
        <p className="eyebrow">{greet()},</p>
        <h1>{user?.name || "there"}</h1>
      </header>

      <InstallAppCard />

      {isOwner ? (
        <OwnerHome dashboard={dashboard} today={today} />
      ) : (
        <StaffHome dashboard={dashboard} punchStatus={punchStatus} />
      )}
    </div>
  );
}

function StaffHome({ dashboard, punchStatus }) {
  const isPunchedIn = Boolean(punchStatus?.is_punched_in);
  const punchInTime = punchStatus?.open_record?.punch_in_time;
  const commissionKpi = dashboard?.kpis?.find((k) => k.key === "month_commission");
  const salesKpi = dashboard?.kpis?.find((k) => k.key === "month_sales");
  const nextBooking = dashboard?.next_booking;

  return (
    <>
      <section className={`punch-card ${isPunchedIn ? "is-in" : ""}`}>
        <div>
          <p className="card-label">Today</p>
          <strong>
            {isPunchedIn ? `Punched in since ${formatTime(punchInTime)}` : "Not punched in yet"}
          </strong>
        </div>
        <Link to="/attendance" className="btn btn-light">
          {isPunchedIn ? "Punch out" : "Punch in"}
        </Link>
      </section>

      <section className="stat-row">
        <div className="stat-tile">
          <p className="card-label">Commission (MTD)</p>
          <strong>{formatInr(commissionKpi?.value)}</strong>
        </div>
        <div className="stat-tile">
          <p className="card-label">Serviced sales (MTD)</p>
          <strong>{formatInr(salesKpi?.value)}</strong>
        </div>
      </section>

      <section className="status-card">
        <p className="card-label">Next booking</p>
        {nextBooking ? (
          <>
            <strong>{nextBooking.customer_name}</strong>
            <p className="muted">{nextBooking.service_label}</p>
            <p className="muted">{formatTime(nextBooking.start_time)}</p>
          </>
        ) : (
          <p className="muted">No upcoming bookings.</p>
        )}
      </section>

      <Link to="/earnings" className="link-row">
        View my collections →
      </Link>
    </>
  );
}

function OwnerHome({ dashboard, today }) {
  const todaySales = dashboard?.sales?.today;

  return (
    <>
      <section className="stat-row">
        <div className="stat-tile">
          <p className="card-label">Sales today</p>
          <strong>{formatInr(todaySales?.value)}</strong>
        </div>
        <div className="stat-tile">
          <p className="card-label">Staff on duty</p>
          <strong>
            {today?.summary?.on_duty ?? "—"} / {today?.summary?.total_staff ?? "—"}
          </strong>
        </div>
      </section>

      <section className="quick-links">
        <Link to="/team" className="quick-link">Team sales today</Link>
        <Link to="/attendance" className="quick-link">Punch</Link>
        <Link to="/reports" className="quick-link">Reports lite</Link>
      </section>

      <section className="status-card">
        <p className="card-label">Today&apos;s bookings</p>
        <strong>{dashboard?.kpis?.find((k) => k.key === "todays_bookings")?.value ?? "—"}</strong>
      </section>
    </>
  );
}
