import { useId } from "react";
import { formatInr } from "../../utils/earningsFormat.js";
import { KpiIcon } from "./KpiIcons.jsx";

const TONE_CLASS = {
  primary: "kpi-card--primary",
  info: "kpi-card--info",
  success: "kpi-card--success",
  warning: "kpi-card--warning",
  danger: "kpi-card--danger",
  neutral: "kpi-card--neutral",
};

const SPARKLINE_COLORS = {
  primary: { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.18)" },
  info: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.18)" },
  success: { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.18)" },
  warning: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.18)" },
  danger: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.18)" },
  neutral: { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.18)" },
};

function formatValue(value, format) {
  if (format === "currency") {
    return formatInr(Number(value || 0));
  }

  if (format === "percent") {
    return `${Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 1,
    })}%`;
  }

  return Number(value || 0).toLocaleString("en-IN");
}

function Sparkline({ values = [], tone = "primary" }) {
  const gradientId = useId();
  const safeValues = values.length ? values : [0];
  const width = 112;
  const height = 44;
  const padding = 3;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const colors = SPARKLINE_COLORS[tone] || SPARKLINE_COLORS.neutral;

  const coords = safeValues.map((value, index) => {
    const x =
      padding +
      (index * (width - padding * 2)) / Math.max(safeValues.length - 1, 1);
    const y =
      height -
      padding -
      ((Number(value) - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePoints = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = [
    `${coords[0].x},${height - padding}`,
    ...coords.map(({ x, y }) => `${x},${y}`),
    `${coords[coords.length - 1].x},${height - padding}`,
  ].join(" ");

  const lastPoint = coords[coords.length - 1];

  return (
    <svg
      className={`kpi-card__sparkline kpi-card__sparkline--${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon className="kpi-card__sparkline-area" points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline className="kpi-card__sparkline-line" points={linePoints} stroke={colors.stroke} />
      <circle
        className="kpi-card__sparkline-dot"
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2.5"
        fill={colors.stroke}
      />
    </svg>
  );
}

export default function KpiCard({
  label,
  value,
  period = "Today",
  tone = "neutral",
  format,
  icon = "bookings",
  trend,
  sparkline = [],
}) {
  const trendDirection = trend?.direction || "neutral";
  const trendPercent = trend?.percent ?? 0;
  const trendLabel = trend?.label || "vs previous period";
  const isPositiveTrend = trendDirection === "up";
  const isNegativeTrend = trendDirection === "down";

  return (
    <article className={`kpi-card ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}>
      <div className="kpi-card__top">
        <div className="kpi-card__icon-wrap" aria-hidden="true">
          <KpiIcon name={icon} />
        </div>

        <div className="kpi-card__titles">
          <p className="kpi-card__label">{label}</p>
          <p className="kpi-card__period">{period}</p>
        </div>
      </div>

      <p className="kpi-card__value">{formatValue(value, format)}</p>

      <div className="kpi-card__footer">
        <div
          className={`kpi-card__trend ${
            isPositiveTrend
              ? "kpi-card__trend--up"
              : isNegativeTrend
                ? "kpi-card__trend--down"
                : "kpi-card__trend--neutral"
          }`}
        >
          <div className="kpi-card__trend-main">
            <span className="kpi-card__trend-arrow" aria-hidden="true">
              {isPositiveTrend ? "↑" : isNegativeTrend ? "↓" : "•"}
            </span>
            <span className="kpi-card__trend-value">{trendPercent}%</span>
          </div>
          <span className="kpi-card__trend-label">{trendLabel}</span>
        </div>

        <Sparkline values={sparkline} tone={tone} />
      </div>
    </article>
  );
}
