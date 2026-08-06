import { formatInr } from "../utils/format.js";

function TargetRow({ label, progress }) {
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  const completed = Boolean(progress?.completed);

  return (
    <div className={`target-row ${completed ? "is-complete" : ""}`}>
      <div className="target-row__header">
        <strong>{label}</strong>
        <span>{percent}%</span>
      </div>
      <div className="target-row__track" aria-hidden="true">
        <div className="target-row__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="target-row__meta">
        <span>Done {formatInr(progress?.achieved)}</span>
        <span>Goal {formatInr(progress?.target)}</span>
      </div>
      <p className="target-row__pending">
        {completed
          ? "Target completed"
          : `${formatInr(progress?.pending)} more to go`}
      </p>
    </div>
  );
}

export default function MonthlyTargetsCard({
  targets,
  loading = false,
  error = null,
  title = "Monthly targets",
}) {
  if (loading) {
    return (
      <section className="status-card target-card">
        <p className="card-label">{title}</p>
        <p className="muted">Loading targets…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="status-card target-card">
        <p className="card-label">{title}</p>
        <p className="form-error">{error}</p>
      </section>
    );
  }

  if (!targets?.staff) {
    return (
      <section className="status-card target-card">
        <p className="card-label">{title}</p>
        <p className="muted">
          No staff profile linked yet. Ask your manager to set your salary targets in Staff Master.
        </p>
      </section>
    );
  }

  const monthLabel = targets?.period
    ? new Date(targets.period.year, targets.period.month - 1, 1).toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <section className="status-card target-card">
      <div className="target-card__top">
        <div>
          <p className="card-label">{title}</p>
          <strong className="target-card__month">{monthLabel}</strong>
        </div>
        <div className="target-card__achieved">
          <p className="card-label">Achieved</p>
          <strong>{formatInr(targets.achieved)}</strong>
        </div>
      </div>

      <TargetRow label="1st target" progress={targets.target_1} />
      <TargetRow label="2nd target" progress={targets.target_2} />
    </section>
  );
}
