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

const STOCK_FILTERS = [
  { key: "all", label: "All stock" },
  { key: "low", label: "Low stock" },
];

function StatusBadge({ isActive }) {
  return (
    <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function StockBadge({ product }) {
  if (!product.is_active) {
    return <span className="product-stock-pill neutral">—</span>;
  }

  if (product.is_low_stock) {
    return (
      <span className="product-stock-pill low">
        Low ({product.current_stock})
      </span>
    );
  }

  return (
    <span className="product-stock-pill ok">{product.current_stock}</span>
  );
}

export default function ProductList() {
  const { hasPermission } = usePermission();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

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

        if (stockFilter === "low") {
          params.low_stock = "true";
        }

        const response = await arnavApi.listProducts(params);

        if (!response.success) {
          throw new Error(response.message || "Failed to load products");
        }

        if (!cancelled) {
          setProducts(response.data || []);
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
  }, [statusFilter, stockFilter]);

  const summary = useMemo(() => {
    const activeCount = products.filter((product) => product.is_active).length;
    const lowStockCount = products.filter(
      (product) => product.is_active && product.is_low_stock
    ).length;

    return {
      total: products.length,
      active: activeCount,
      lowStock: lowStockCount,
    };
  }, [products]);

  return (
    <div className="page product-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>Products</h1>
          <p className="page-description">
            Retail inventory master with stock levels and reorder thresholds.
          </p>
        </div>

        <div className="user-permissions-header-actions">
          <Link to="/settings" className="user-secondary-btn">
            Back to settings
          </Link>
          {canCreate && (
            <Link to="/settings/products/new" className="user-primary-btn">
              Add product
            </Link>
          )}
        </div>
      </header>

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
          <span className="user-summary-label">Low stock</span>
          <strong>{summary.lowStock}</strong>
        </div>
      </section>

      <div className="service-filter-bar">
        <div className="user-filter-row">
          {STOCK_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`user-filter-btn ${
                stockFilter === filter.key ? "active" : ""
              }`}
              onClick={() => setStockFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

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
        {loading && <p>Loading products…</p>}

        {!loading && !error && products.length === 0 && (
          <p className="page-note">No products found for this filter.</p>
        )}

        {!loading && products.length > 0 && (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Reorder level</th>
                  <th>Purchase</th>
                  <th>Sale</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>{product.sku}</td>
                    <td>{product.unit}</td>
                    <td>
                      <StockBadge product={product} />
                    </td>
                    <td>{product.reorder_level}</td>
                    <td>{formatInr(product.purchase_price)}</td>
                    <td>{formatInr(product.sale_price)}</td>
                    <td>
                      <StatusBadge isActive={product.is_active} />
                    </td>
                    <td>
                      {canEdit ? (
                        <Link
                          to={`/settings/products/${product.id}/edit`}
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
