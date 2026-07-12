import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";
import { formatInr } from "../../../utils/earningsFormat.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

function StatusBadge({ isActive }) {
  return (
    <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function ServiceList() {
  const { hasPermission } = usePermission();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState(null);

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

        if (categoryFilter !== "all") {
          params.category_id = categoryFilter;
        }

        const [servicesResponse, categoriesResponse] = await Promise.all([
          arnavApi.listServices(params),
          arnavApi.listServiceCategories(),
        ]);

        if (!servicesResponse.success) {
          throw new Error(servicesResponse.message || "Failed to load services");
        }

        if (!categoriesResponse.success) {
          throw new Error(
            categoriesResponse.message || "Failed to load categories"
          );
        }

        if (cancelled) return;

        setServices(servicesResponse.data || []);
        setCategories(categoriesResponse.data || []);
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
  }, [statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    const activeCount = services.filter((service) => service.is_active).length;
    return {
      total: services.length,
      active: activeCount,
      inactive: services.length - activeCount,
    };
  }, [services]);

  async function handleCreateCategory(event) {
    event.preventDefault();

    if (!canCreate || !newCategoryName.trim()) {
      return;
    }

    setCategorySaving(true);
    setCategoryMessage(null);
    setError(null);

    try {
      const response = await arnavApi.createServiceCategory({
        name: newCategoryName.trim(),
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to create category");
      }

      setCategories((prev) =>
        [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewCategoryName("");
      setCategoryMessage(`Category "${response.data.name}" created`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setCategorySaving(false);
    }
  }

  return (
    <div className="page service-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>Services</h1>
          <p className="page-description">
            Service catalog with category, duration, price, and optional
            commission slab override.
          </p>
        </div>

        <div className="user-permissions-header-actions">
          <Link to="/settings" className="user-secondary-btn">
            Back to settings
          </Link>
          {canCreate && (
            <Link to="/settings/services/new" className="user-primary-btn">
              Add service
            </Link>
          )}
        </div>
      </header>

      {categoryMessage && <p className="user-success-text">{categoryMessage}</p>}
      {error && <p className="status-error">{error}</p>}

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

      <div className="service-filter-bar">
        <label className="service-filter-select">
          Category
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
                {!category.is_active ? " (inactive)" : ""}
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

      {canCreate && (
        <form className="status-card service-category-form" onSubmit={handleCreateCategory}>
          <label>
            Quick add category
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="e.g. Bridal"
              maxLength={120}
            />
          </label>
          <button
            type="submit"
            className="user-secondary-btn"
            disabled={categorySaving || !newCategoryName.trim()}
          >
            {categorySaving ? "Saving…" : "Add category"}
          </button>
        </form>
      )}

      <section className="status-card user-table-card">
        {loading && <p>Loading services…</p>}

        {!loading && !error && services.length === 0 && (
          <p className="page-note">No services found for this filter.</p>
        )}

        {!loading && services.length > 0 && (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Commission override</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                    </td>
                    <td>{service.category?.name || "—"}</td>
                    <td>{service.duration_minutes} min</td>
                    <td>{formatInr(service.price)}</td>
                    <td>
                      {service.commission_slab_override_id
                        ? String(service.commission_slab_override_id).slice(-6)
                        : "Staff default"}
                    </td>
                    <td>
                      <StatusBadge isActive={service.is_active} />
                    </td>
                    <td>
                      {canEdit ? (
                        <Link
                          to={`/settings/services/${service.id}/edit`}
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
