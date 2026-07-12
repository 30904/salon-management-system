import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const APPLIES_TO_FILTERS = [
  { key: "all", label: "All types" },
  { key: "service", label: "Services" },
  { key: "product", label: "Products" },
  { key: "both", label: "Both" },
];

function StatusBadge({ isActive }) {
  return (
    <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function AppliesToBadge({ appliesTo }) {
  return (
    <span className={`tax-applies-pill ${appliesTo}`}>
      {appliesTo === "both" ? "Services & products" : appliesTo}
    </span>
  );
}

function formatRate(rate) {
  return `${Number(rate || 0)}%`;
}

export default function TaxList() {
  const { hasPermission } = usePermission();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliesToFilter, setAppliesToFilter] = useState("all");

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

        if (appliesToFilter !== "all") {
          params.applies_to = appliesToFilter;
        }

        const response = await arnavApi.listTaxes(params);

        if (!response.success) {
          throw new Error(response.message || "Failed to load taxes");
        }

        if (!cancelled) {
          setTaxes(response.data || []);
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
  }, [statusFilter, appliesToFilter]);

  const summary = useMemo(() => {
    const activeCount = taxes.filter((tax) => tax.is_active).length;
    const serviceCount = taxes.filter(
      (tax) => tax.applies_to === "service" || tax.applies_to === "both"
    ).length;
    const productCount = taxes.filter(
      (tax) => tax.applies_to === "product" || tax.applies_to === "both"
    ).length;

    return {
      total: taxes.length,
      active: activeCount,
      service: serviceCount,
      product: productCount,
    };
  }, [taxes]);

  return (
    <div className="page tax-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>Tax / GST</h1>
          <p className="page-description">
            Configure separate GST rates for services, products, or both.
          </p>
        </div>

        <div className="user-permissions-header-actions">
          <Link to="/settings" className="user-secondary-btn">
            Back to settings
          </Link>
          {canCreate && (
            <Link to="/settings/tax/new" className="user-primary-btn">
              Add tax rate
            </Link>
          )}
        </div>
      </header>

      {error && <p className="status-error">{error}</p>}

      <section className="user-summary-row tax-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Shown</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Service rates</span>
          <strong>{summary.service}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Product rates</span>
          <strong>{summary.product}</strong>
        </div>
      </section>

      <div className="service-filter-bar">
        <label className="service-filter-select">
          Applies to
          <select
            value={appliesToFilter}
            onChange={(event) => setAppliesToFilter(event.target.value)}
          >
            {APPLIES_TO_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <div className="user-filter-row">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`user-filter-btn ${
                statusFilter === filter.key ? "active" : ""
              }`}
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="status-card user-table-card">
        {loading && <p>Loading tax rates…</p>}

        {!loading && !error && taxes.length === 0 && (
          <p className="page-note">No tax rates found for this filter.</p>
        )}

        {!loading && taxes.length > 0 && (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rate</th>
                  <th>Applies to</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxes.map((tax) => (
                  <tr key={tax.id}>
                    <td>
                      <strong>{tax.name}</strong>
                    </td>
                    <td>{formatRate(tax.rate)}</td>
                    <td>
                      <AppliesToBadge appliesTo={tax.applies_to} />
                    </td>
                    <td>
                      <StatusBadge isActive={tax.is_active} />
                    </td>
                    <td>
                      {canEdit ? (
                        <Link
                          to={`/settings/tax/${tax.id}/edit`}
                          className="user-row-link"
                        >
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
        )}
      </section>
    </div>
  );
}
