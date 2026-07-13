import { formatInr } from "../../utils/earningsFormat.js";

const TONE_CLASS = {
  primary: "kpi-card--primary",
  info: "kpi-card--info",
  success: "kpi-card--success",
  warning: "kpi-card--warning",
  danger: "kpi-card--danger",
  neutral: "kpi-card--neutral",
};

function formatValue(value, format) {
  if (format === "currency") {
    return formatInr(Number(value || 0));
  }

  return Number(value || 0).toLocaleString("en-IN");
}

export default function KpiCard({ label, value, hint, tone = "neutral", format }) {
  return (
    <article className={`kpi-card ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}>
      <div className="kpi-card__accent" aria-hidden="true" />
      <div className="kpi-card__body">
        <p className="kpi-card__label">{label}</p>
        <p className="kpi-card__value">{formatValue(value, format)}</p>
        {hint ? <p className="kpi-card__hint">{hint}</p> : null}
      </div>
    </article>
  );
}
