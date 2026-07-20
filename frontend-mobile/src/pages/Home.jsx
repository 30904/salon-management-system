import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { attendanceApi, dashboardApi } from "../api/index.js";
import InstallAppCard from "../components/InstallAppCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { useLiveClock } from "../hooks/useLiveClock.js";
import { usePermission } from "../hooks/usePermission.js";
import {
  formatDateBadge,
  formatDayName,
  formatInr,
  formatLiveClock,
  formatTime,
  readEntityLabel,
} from "../utils/format.js";

function getUserSubtitle(user) {
  const role = readEntityLabel(user?.role_id, readEntityLabel(user?.role, "Team member"));
  const branch = readEntityLabel(user?.branch_id, readEntityLabel(user?.branch, ""));
  return branch ? `${role} • ${branch}` : role;
}

function getShiftState(punchStatus) {
  if (!punchStatus) {
    return {
      label: "Punch In",
      hint: "Tap to start shift",
      variant: "idle",
      punchIn: null,
      punchOut: null,
      canPunch: true,
    };
  }

  const isPunchedIn = Boolean(punchStatus.is_punched_in);
  const openIn = punchStatus.open_record?.punch_in_time;
  const today = punchStatus.today_record;
  const todayIn = today?.punch_in_time;
  const todayOut = today?.punch_out_time;

  if (isPunchedIn) {
    return {
      label: "Punch Out",
      hint: "Tap to end shift",
      variant: "active",
      punchIn: openIn || todayIn,
      punchOut: null,
      canPunch: true,
    };
  }

  if (todayIn && todayOut) {
    return {
      label: "Shift Completed",
      hint: "See you tomorrow",
      variant: "completed",
      punchIn: todayIn,
      punchOut: todayOut,
      canPunch: false,
    };
  }

  return {
    label: "Punch In",
    hint: "Tap to start shift",
    variant: "idle",
    punchIn: todayIn || null,
    punchOut: todayOut || null,
    canPunch: true,
  };
}

function WelcomeBlock({ user }) {
  return (
    <section className="mobile-welcome">
      <h1>Welcome, {user?.name || "there"}!</h1>
      <p>{getUserSubtitle(user)}</p>
    </section>
  );
}

function DateTimeCard({ now }) {
  const { day, month, year } = formatDateBadge(now);

  return (
    <section className="mobile-datetime-card">
      <DateTimeLeft day={day} month={month} year={year} />
      <div className="mobile-datetime-card__right">
        <strong className="mobile-datetime-card__clock">{formatLiveClock(now)}</strong>
        <span className="mobile-datetime-card__today">TODAY</span>
        <span className="mobile-datetime-card__day">{formatDayName(now)}</span>
      </div>
    </section>
  );
}

function DateTimeLeft({ day, month, year }) {
  return (
    <div className="mobile-datetime-card__left">
      <div className="mobile-datetime-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12.5 8H4.5v9.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5V10ZM6 6h-.5a.5.5 0 0 0-.5.5V8h13V6.5a.5.5 0 0 0-.5-.5H18v1a1 1 0 1 1-2 0V6h-8v1a1 1 0 1 1-2 0V6Z" />
        </svg>
      </div>
      <div className="mobile-datetime-card__date">
        <strong>{day}</strong>
        <span className="mobile-datetime-card__month">{month}</span>
        <span className="mobile-datetime-card__year">{year}</span>
      </div>
    </div>
  );
}

function ShiftStatusCard({ punchStatus, busy, error, onPunch }) {
  const shift = getShiftState(punchStatus);

  return (
    <section className={`mobile-shift-card mobile-shift-card--${shift.variant}`}>
      <button
        type="button"
        className="mobile-shift-card__ring"
        onClick={onPunch}
        disabled={busy || !shift.canPunch}
        aria-label={shift.label}
      >
        <span className="mobile-shift-card__ring-label">
          {busy ? "Please wait…" : shift.label}
        </span>
        {!busy && <small className="mobile-shift-card__ring-hint">{shift.hint}</small>}
      </button>

      {error && <p className="form-error mobile-shift-card__error">{error}</p>}

      <div className="mobile-shift-card__times">
        <div className="mobile-shift-card__time">
          <span className="mobile-shift-card__time-icon mobile-shift-card__time-icon--in" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 5v4.586l2.707 2.707-1.414 1.414L11 12.414V7Z" />
            </svg>
          </span>
          <strong>{formatTime(shift.punchIn)}</strong>
        </div>

        <div className="mobile-shift-card__time">
          <span className="mobile-shift-card__time-icon mobile-shift-card__time-icon--out" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm3.707 10.707-1.414 1.414L11 12.414V7h2v5.707Z" />
            </svg>
          </span>
          <strong>{formatTime(shift.punchOut)}</strong>
        </div>
      </div>

      {!shift.canPunch && (
        <Link to="/attendance" className="mobile-shift-card__action">
          View attendance
        </Link>
      )}
    </section>
  );
}

export default function Home() {
  const { user, isOwner } = usePermission();
  const { showToast } = useToast();
  const now = useLiveClock();
  const [dashboard, setDashboard] = useState(null);
  const [punchStatus, setPunchStatus] = useState(null);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [punchBusy, setPunchBusy] = useState(false);
  const [punchError, setPunchError] = useState(null);

  const refreshPunchStatus = useCallback(async () => {
    const statusRes = await attendanceApi.getAttendanceStatus().catch(() => null);
    setPunchStatus(statusRes?.data || null);
    return statusRes?.data || null;
  }, []);

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

  async function handlePunch() {
    const shift = getShiftState(punchStatus);
    if (!shift.canPunch || punchBusy) return;

    const action = shift.variant === "active" ? "out" : "in";

    setPunchBusy(true);
    setPunchError(null);

    try {
      const payload = { punch_time: new Date().toISOString() };
      const res =
        action === "in"
          ? await attendanceApi.punchIn(payload)
          : await attendanceApi.punchOut(payload);

      if (!res.success) {
        throw new Error(res.message || "Punch failed");
      }

      showToast(
        action === "in" ? "Punched in successfully" : "Punched out successfully",
        "success"
      );
      await refreshPunchStatus();
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Punch failed";
      setPunchError(message);
      showToast(message, "error");
    } finally {
      setPunchBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-pad">
        <p className="form-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-pad mobile-home">
      <WelcomeBlock user={user} />
      <DateTimeCard now={now} />
      <ShiftStatusCard
        punchStatus={punchStatus}
        busy={punchBusy}
        error={punchError}
        onPunch={handlePunch}
      />

      {isOwner ? (
        <OwnerHome dashboard={dashboard} today={today} />
      ) : (
        <StaffHome dashboard={dashboard} />
      )}

      <InstallAppCard />
    </div>
  );
}

function StaffHome({ dashboard }) {
  const commissionKpi = dashboard?.kpis?.find((k) => k.key === "month_commission");
  const salesKpi = dashboard?.kpis?.find((k) => k.key === "month_sales");
  const nextBooking = dashboard?.next_booking;

  return (
    <>
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
        <Link to="/team" className="quick-link">
          Team sales today
        </Link>
        <Link to="/attendance" className="quick-link">
          Punch
        </Link>
        <Link to="/reports" className="quick-link">
          Reports lite
        </Link>
      </section>

      <section className="status-card">
        <p className="card-label">Today&apos;s bookings</p>
        <strong>
          {dashboard?.kpis?.find((k) => k.key === "todays_bookings")?.value ?? "—"}
        </strong>
      </section>
    </>
  );
}
