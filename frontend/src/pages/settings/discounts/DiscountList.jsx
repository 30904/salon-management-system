import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const WEEKDAY_LABELS = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function StatusBadge({ isActive }) {
  return (
    <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function formatDays(days) {
  if (!Array.isArray(days) || days.length === 0) return "—";
  return [...days].sort((a, b) => a - b).map((day) => WEEKDAY_LABELS[day] || day).join(", ");
}

export default function DiscountList() {
  const { hasPermission } = usePermission();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const canCreate = hasPermission("settings", "create");
  const canEdit = hasPermission("settings", "edit");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = {};
        if (statusFilter !== "all") {
          params.is_active = statusFilter === "active" ? "true" : "false";
        }

        const response = await arnavApi.listDiscounts(params);
        if (!response.success) {
          throw new Error(response.message || "Failed to load discount types");
        }
        if (!cancelled) {
          setDiscounts(response.data || []);
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
  }, [statusFilter]);

  const summary = useMemo(() => {
    const activeCount = discounts.filter((item) => item.is_active).length;
    return {
      total: discounts.length,
      active: activeCount,
      inactive: discounts.length - activeCount,
    };
  }, [discounts]);

  return (
    <div className="page discount-list-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Discount Master</h1>
          <p>Create named discount types with weekday, time window, and percent for POS billing.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/settings" className="module-hero-btn">
            Back to settings
          </Link>
          {canCreate ? (
            <Link to="/settings/discounts/new" className="module-hero-btn">
              Add discount type
            </Link>
          ) : null}
        </div>
      </header>

      {error ? <p className="status-error">{error}</p> : null}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Shown</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Inactive</span>
          <strong>{summary.inactive}</strong>
        </div>
      </section>

      <div className="module-panel service-filter-bar">
        <div className="user-filter-row">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`user-filter-btn ${statusFilter === filter.key ? "active" : ""}`}
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="status-card user-table-card">
        {loading ? <p>Loading discount types…</p> : null}

        {!loading && !error && discounts.length === 0 ? (
          <p className="page-note">No discount types found for this filter.</p>
        ) : null}

        {!loading && discounts.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Percent</th>
                  <th>Days</th>
                  <th>Time window</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id}>
                    <td>
                      <strong>{discount.name}</strong>
                    </td>
                    <td>{Number(discount.percent || 0)}%</td>
                    <td>{formatDays(discount.days)}</td>
                    <td>
                      {discount.start_time} – {discount.end_time}
                    </td>
                    <td>
                      <StatusBadge isActive={discount.is_active} />
                    </td>
                    <td>
                      {canEdit ? (
                        <Link to={`/settings/discounts/${discount.id}/edit`} className="user-row-link">
                          Edit
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
