import { formatInr } from "../../utils/earningsFormat.js";

const SALES_TILES = [
  { key: "year_to_date", label: "Year to date sales", caption: "This year" },
  { key: "month_to_date", label: "Month to date sales", caption: "This month" },
  { key: "today", label: "Today's sales", caption: "So far today" },
];

function TrendPill({ trend }) {
  const direction = trend?.direction || "neutral";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "•";

  return (
    <span className={`sales-hero__trend sales-hero__trend--${direction}`}>
      <span aria-hidden="true">{arrow}</span>
      {trend?.percent ?? 0}% {trend?.label}
    </span>
  );
}

export default function SalesHero({ sales, title = "Sales overview" }) {
  return (
    <section className="dashboard-hero sales-hero">
      <div className="sales-hero__header">
        <p className="sales-hero__eyebrow">{title}</p>
      </div>

      <div className="sales-hero__grid">
        {SALES_TILES.map((tile) => {
          const metric = sales?.[tile.key];

          return (
            <div key={tile.key} className="sales-hero__tile">
              <p className="sales-hero__label">{tile.label}</p>
              <p className="sales-hero__value">
                {metric ? formatInr(metric.value) : "—"}
              </p>
              {metric?.has_comparison ? (
                <TrendPill trend={metric.trend} />
              ) : (
                <span className="sales-hero__caption">{tile.caption}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
