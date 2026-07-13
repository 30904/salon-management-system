function formatIssueTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function issueLabel(status) {
  return status === "no_show" ? "No show" : "Cancelled";
}

export default function NeedsAttentionCard({
  needsAttention,
  title = "Needs attention",
  subtitle = "Low stock and booking issues",
}) {
  const summary = needsAttention?.summary || {};
  const lowStock = needsAttention?.low_stock || [];
  const issues = needsAttention?.issues || [];
  const isEmpty = !lowStock.length && !issues.length;

  return (
    <article className="dashboard-side-card">
      <header className="dashboard-side-card__header">
        <h2 className="dashboard-side-card__title">{title}</h2>
        <p className="dashboard-side-card__subtitle">{subtitle}</p>
      </header>

      <div className="dashboard-attention-summary">
        <span className="dashboard-attention-pill dashboard-attention-pill--danger">
          {summary.low_stock_count || 0} low stock
        </span>
        <span className="dashboard-attention-pill dashboard-attention-pill--warning">
          {summary.cancelled_count || 0} cancelled
        </span>
        <span className="dashboard-attention-pill dashboard-attention-pill--neutral">
          {summary.no_show_count || 0} no-shows
        </span>
      </div>

      {isEmpty ? (
        <p className="dashboard-side-card__empty">Everything looks good right now.</p>
      ) : (
        <div className="dashboard-side-card__body">
          <div className="dashboard-attention-sections">
            {lowStock.length > 0 ? (
              <section className="dashboard-attention-section">
                <h3>Low stock</h3>
                <ul className="dashboard-attention-list">
                  {lowStock.map((product) => (
                    <li key={product.id} className="dashboard-attention-list__item">
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.sku}</span>
                      </div>
                      <span className="dashboard-attention-list__value">
                        {product.current_stock}/{product.reorder_level} {product.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {issues.length > 0 ? (
              <section className="dashboard-attention-section">
                <h3>Recent issues</h3>
                <ul className="dashboard-attention-list">
                  {issues.map((issue) => (
                    <li key={issue.id} className="dashboard-attention-list__item">
                      <div>
                        <strong>{issue.customer_name}</strong>
                        <span>{issue.service_label}</span>
                      </div>
                      <div className="dashboard-attention-list__meta">
                        <span
                          className={`dashboard-attention-tag dashboard-attention-tag--${issue.status}`}
                        >
                          {issueLabel(issue.status)}
                        </span>
                        <span>{formatIssueTime(issue.start_time)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
