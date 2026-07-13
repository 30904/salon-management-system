export default function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
}) {
  return (
    <article className={`chart-panel ${className}`.trim()}>
      <header className="chart-panel__header">
        <h2 className="chart-panel__title">{title}</h2>
        {subtitle ? <p className="chart-panel__subtitle">{subtitle}</p> : null}
      </header>
      <div className="chart-panel__body">{children}</div>
    </article>
  );
}
