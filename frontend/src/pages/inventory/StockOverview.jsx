import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { preciousApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import { formatInr } from "../../utils/earningsFormat.js";

export default function StockOverview() {
  const { hasPermission } = usePermission();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // "all" | "low" | "out" | "in"
  const [reasons, setReasons] = useState({ deduct_reasons: [], topup_reasons: [] });

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // { type: "topup" | "deduct" | "audit", product }
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [canOverrideHint, setCanOverrideHint] = useState(false);

  // Form states
  const [formQty, setFormQty] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOverride, setFormOverride] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  const canEditInventory = hasPermission("inventory", "edit");
  const canApproveInventory = hasPermission("inventory", "approve");
  const canEditSettings = hasPermission("settings", "edit") || hasPermission("settings", "view");

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [reportRes, reasonsRes] = await Promise.all([
        preciousApi.getStockReport(),
        preciousApi.getAdjustmentReasons().catch(() => ({ data: { deduct_reasons: [], topup_reasons: [] } })),
      ]);

      if (!reportRes.success) {
        throw new Error(reportRes.message || "Failed to load stock report");
      }

      setReportData(reportRes.data);
      if (reasonsRes?.data) {
        setReasons(reasonsRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = async (type, product) => {
    setActiveModal({ type, product });
    setModalError(null);
    setCanOverrideHint(false);
    setFormQty("1");
    setFormNotes("");
    setFormOverride(false);

    if (type === "topup") {
      setFormReason(reasons.topup_reasons?.[0]?.code || "stock_in");
    } else if (type === "deduct") {
      setFormReason(reasons.deduct_reasons?.[0]?.code || "manual_deduct");
    } else if (type === "audit") {
      setModalLoading(true);
      try {
        const res = await preciousApi.getProductAuditLog(product.id);
        if (res.success) {
          setAuditLogs(res.data?.logs || []);
        }
      } catch (err) {
        setModalError(err.response?.data?.message || err.message);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalError(null);
    setCanOverrideHint(false);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!activeModal?.product) return;

    const qtyNum = Number(formQty);
    if (!qtyNum || qtyNum < 1) {
      setModalError("Please enter a valid quantity of 1 or more.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      if (activeModal.type === "topup") {
        const res = await preciousApi.topUpStock(activeModal.product.id, {
          quantity: qtyNum,
          reason: formReason,
          notes: formNotes,
        });
        if (!res.success) throw new Error(res.message || "Failed to top up stock");
      } else if (activeModal.type === "deduct") {
        const res = await preciousApi.deductStock(activeModal.product.id, {
          quantity: qtyNum,
          reason: formReason,
          notes: formNotes,
          force_override: formOverride,
        });
        if (!res.success) throw new Error(res.message || "Failed to deduct stock");
      }

      closeModal();
      await loadData(true);
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.can_override && canApproveInventory) {
        setCanOverrideHint(true);
      }
      setModalError(respData?.message || err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!reportData?.products) return [];
    return reportData.products.filter((p) => {
      if (stockFilter === "low" && p.status !== "low_stock" && p.status !== "out_of_stock") return false;
      if (stockFilter === "out" && p.status !== "out_of_stock") return false;
      if (stockFilter === "in" && p.status !== "in_stock") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      return true;
    });
  }, [reportData, stockFilter, searchQuery]);

  const summary = reportData?.summary || {};
  const alerts = reportData?.reorder_alerts || [];

  return (
    <div className="page inventory-page">
      {/* Hero Banner linking to Arnav's Product Settings */}
      <section className="inventory-hero-banner">
        <div className="inventory-hero-content">
          <p className="dashboard-hero__eyebrow" style={{ color: "rgba(248, 250, 252, 0.72)" }}>Inventory & Stock Management</p>
          <h1>Stock Overview & Reorder Alerts</h1>
          <p>
            Monitor live retail inventory, track low stock deficits, and instantly top-up or deduct units. 
            Reorder thresholds and product master details are managed centrally.
          </p>
        </div>
        <div className="inventory-hero-actions">
          <button type="button" onClick={() => loadData(true)} className="inventory-arnav-link">
            ↻ Refresh
          </button>
          <Link to="/settings/products" className="inventory-arnav-link">
            Manage Product Settings →
          </Link>
        </div>
      </section>

      {loading && <p className="status-note">Loading inventory metrics & stock report…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && reportData && (
        <>
          {/* KPI Summary Grid */}
          <section className="inventory-kpi-grid">
            <div className="inventory-kpi-card">
              <div className="inventory-kpi-top">
                <div className="inventory-kpi-icon-wrap primary" aria-hidden="true">
                  PRD
                </div>
                <div className="inventory-kpi-titles">
                  <p className="inventory-kpi-label">Total Products</p>
                  <p className="inventory-kpi-period">Current Catalog</p>
                </div>
              </div>
              <p className="inventory-kpi-value">{summary.total_products || 0}</p>
              <span className="inventory-kpi-sub">
                {summary.total_stock_units || 0} total units in stock
              </span>
            </div>

            <div className="inventory-kpi-card">
              <div className="inventory-kpi-top">
                <div className={`inventory-kpi-icon-wrap ${summary.out_of_stock_count > 0 ? "danger" : "info"}`} aria-hidden="true">
                  OUT
                </div>
                <div className="inventory-kpi-titles">
                  <p className="inventory-kpi-label">Out of Stock</p>
                  <p className="inventory-kpi-period">Immediate Action</p>
                </div>
              </div>
              <p className="inventory-kpi-value" style={{ color: summary.out_of_stock_count > 0 ? "#dc2626" : "inherit" }}>
                {summary.out_of_stock_count || 0}
              </p>
              <span className="inventory-kpi-sub">Requires immediate restock</span>
            </div>

            <div className="inventory-kpi-card">
              <div className="inventory-kpi-top">
                <div className={`inventory-kpi-icon-wrap ${summary.low_stock_count > 0 ? "warning" : "info"}`} aria-hidden="true">
                  LOW
                </div>
                <div className="inventory-kpi-titles">
                  <p className="inventory-kpi-label">Low Stock Alerts</p>
                  <p className="inventory-kpi-period">Reorder Threshold</p>
                </div>
              </div>
              <p className="inventory-kpi-value" style={{ color: summary.low_stock_count > 0 ? "#d97706" : "inherit" }}>
                {summary.low_stock_count || 0}
              </p>
              <span className="inventory-kpi-sub">At or below reorder threshold</span>
            </div>

            <div className="inventory-kpi-card">
              <div className="inventory-kpi-top">
                <div className="inventory-kpi-icon-wrap primary" aria-hidden="true">
                  VAL
                </div>
                <div className="inventory-kpi-titles">
                  <p className="inventory-kpi-label">Total Valuation (Purchase)</p>
                  <p className="inventory-kpi-period">Asset Valuation</p>
                </div>
              </div>
              <p className="inventory-kpi-value">{formatInr(summary.total_stock_value_at_purchase || 0)}</p>
              <span className="inventory-kpi-sub">
                Retail Value: {formatInr(summary.total_stock_value_at_sale || 0)}
              </span>
            </div>
          </section>

          {/* Low Stock Highlights Section */}
          <section className="inventory-alerts-box">
            <div className="inventory-alerts-header">
              <div className="inventory-alerts-title">
                <h2>Low Stock & Reorder Highlights</h2>
                <span className="inventory-alerts-badge">{alerts.length} Alerts</span>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#92400e" }}>
                  Need to change reorder thresholds?
                </span>
                <Link to="/settings/products" className="user-primary-btn" style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}>
                  Product Master (Arnav's screen) →
                </Link>
              </div>
            </div>

            {alerts.length === 0 ? (
              <p style={{ margin: 0, color: "#166534", fontWeight: 600 }}>
                All products are currently well-stocked above their reorder thresholds!
              </p>
            ) : (
              <div className="inventory-alerts-grid">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`inventory-alert-card ${alert.status === "out_of_stock" ? "critical" : ""}`}
                  >
                    <div>
                      <div className="inventory-alert-card__top">
                        <h3>{alert.name}</h3>
                        <span
                          className={`product-stock-pill ${
                            alert.status === "out_of_stock" ? "low" : "low"
                          }`}
                          style={
                            alert.status === "out_of_stock"
                              ? { background: "#fee2e2", color: "#991b1b" }
                              : {}
                          }
                        >
                          {alert.status === "out_of_stock" ? "OUT OF STOCK" : "LOW STOCK"}
                        </span>
                      </div>
                      <span className="inventory-alert-card__sku">SKU: {alert.sku}</span>
                    </div>

                    <div className="inventory-alert-card__stats">
                      <div>
                        <span>Current Stock</span>
                        <strong>
                          {alert.current_stock} {alert.unit}(s)
                        </strong>
                      </div>
                      <div>
                        <span>Reorder Level</span>
                        <strong>
                          {alert.reorder_level} {alert.unit}(s)
                        </strong>
                      </div>
                      <div>
                        <span>Recommended Order</span>
                        <strong style={{ color: "#4338ca" }}>
                          +{alert.recommended_order_quantity} {alert.unit}(s)
                        </strong>
                      </div>
                    </div>

                    <div className="inventory-alert-card__action">
                      <Link
                        to={canEditSettings ? `/settings/products/${alert.id}/edit` : "/settings/products"}
                        style={{ fontSize: "0.8rem", color: "#4338ca", textDecoration: "underline", fontWeight: 600 }}
                      >
                        Adjust Threshold
                      </Link>
                      {canEditInventory && (
                        <button
                          type="button"
                          className="inventory-topup-btn"
                          onClick={() => openModal("topup", alert)}
                        >
                          + Top Up Stock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Full Inventory Table Section */}
          <section className="status-card user-table-card" style={{ background: "var(--s21-surface, #ffffff)", borderRadius: "18px", border: "1px solid #e8edf3", boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
              <div className="user-filter-row">
                <button
                  type="button"
                  className={`user-filter-btn ${stockFilter === "all" ? "active" : ""}`}
                  onClick={() => setStockFilter("all")}
                >
                  All Products ({reportData.products.length})
                </button>
                <button
                  type="button"
                  className={`user-filter-btn ${stockFilter === "low" ? "active" : ""}`}
                  onClick={() => setStockFilter("low")}
                >
                  Low & Out of Stock ({alerts.length})
                </button>
                <button
                  type="button"
                  className={`user-filter-btn ${stockFilter === "out" ? "active" : ""}`}
                  onClick={() => setStockFilter("out")}
                >
                  Out of Stock Only ({summary.out_of_stock_count})
                </button>
                <button
                  type="button"
                  className={`user-filter-btn ${stockFilter === "in" ? "active" : ""}`}
                  onClick={() => setStockFilter("in")}
                >
                  In Stock Only ({reportData.products.length - alerts.length})
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search products or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                    width: "240px"
                  }}
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="page-note">No products match your current filters or search query.</p>
            ) : (
              <div className="user-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th>Stock Status</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
                      <th>Valuation (Cost)</th>
                      <th>Actions & Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                        </td>
                        <td>{p.sku}</td>
                        <td>{p.unit}</td>
                        <td>
                          <span
                            className={`product-stock-pill ${
                              p.status === "out_of_stock" || p.status === "low_stock" ? "low" : "ok"
                            }`}
                            style={
                              p.status === "out_of_stock"
                                ? { background: "#fee2e2", color: "#991b1b" }
                                : {}
                            }
                          >
                            {p.status === "out_of_stock"
                              ? "Out of Stock"
                              : p.status === "low_stock"
                              ? "Low Stock"
                              : "In Stock"}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: "1rem" }}>{p.current_stock}</strong>
                        </td>
                        <td>{p.reorder_level}</td>
                        <td>{formatInr(p.total_purchase_value)}</td>
                        <td>
                          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                            {canEditInventory && (
                              <>
                                <button
                                  type="button"
                                  className="inventory-topup-btn"
                                  onClick={() => openModal("topup", p)}
                                >
                                  + Top Up
                                </button>
                                <button
                                  type="button"
                                  className="inventory-deduct-btn"
                                  onClick={() => openModal("deduct", p)}
                                >
                                  - Deduct
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="user-secondary-btn"
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                              onClick={() => openModal("audit", p)}
                              title="View stock movement audit log"
                            >
                              History
                            </button>
                            {canEditSettings && (
                              <Link
                                to={`/settings/products/${p.id}/edit`}
                                className="user-row-link"
                                style={{ marginLeft: "0.25rem" }}
                              >
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal Dialogs */}
      {activeModal && (
        <div className="inventory-modal-backdrop" onClick={closeModal}>
          <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inventory-modal-header">
              <h3>
                {activeModal.type === "topup" && `Top Up Stock — ${activeModal.product.name}`}
                {activeModal.type === "deduct" && `Manual Deduct — ${activeModal.product.name}`}
                {activeModal.type === "audit" && `Stock Audit History — ${activeModal.product.name}`}
              </h3>
              <button type="button" className="inventory-modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>

            {activeModal.type === "audit" ? (
              <div className="inventory-modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
                {modalLoading ? (
                  <p>Loading audit trail…</p>
                ) : modalError ? (
                  <p className="status-error">{modalError}</p>
                ) : auditLogs.length === 0 ? (
                  <p className="page-note">No recorded stock movement history for this product yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {auditLogs.map((log) => {
                      const details = log.details || {};
                      const isAddition = details.quantity_change > 0 || log.action === "inventory_topup";
                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: "0.75rem",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            background: isAddition ? "#f0fdf4" : "#fef2f2",
                            fontSize: "0.85rem",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem"
                          }}
                        >
                          <div>
                            <strong style={{ color: isAddition ? "#166534" : "#991b1b" }}>
                              {isAddition ? "↗ Top Up" : "↘ Deduction"}: {Math.abs(details.quantity_change || details.quantity || 0)} {activeModal.product.unit}(s)
                            </strong>
                            <div style={{ color: "#475569", marginTop: "0.2rem" }}>
                              Reason: {details.reason || log.action} {details.override_used ? " (Override used)" : ""}
                            </div>
                            {details.notes && (
                              <div style={{ fontStyle: "italic", color: "#64748b", marginTop: "0.2rem" }}>
                                "{details.notes}"
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#64748b" }}>
                            <div>{new Date(log.created_at).toLocaleDateString()}</div>
                            <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                            <div style={{ fontWeight: 600, color: "#334155", marginTop: "0.2rem" }}>
                              By: {log.user_name || "System"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleModalSubmit}>
                <div className="inventory-modal-body">
                  {modalError && <p className="status-error" style={{ marginBottom: "1rem" }}>{modalError}</p>}

                  <div className="inventory-form-group">
                    <label>Current Stock</label>
                    <div style={{ padding: "0.5rem 0.85rem", background: "#f1f5f9", borderRadius: "8px", fontWeight: 700 }}>
                      {activeModal.product.current_stock} {activeModal.product.unit}(s)
                    </div>
                  </div>

                  <div className="inventory-form-group">
                    <label>
                      {activeModal.type === "topup" ? "Quantity to Add" : "Quantity to Deduct"} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      placeholder="Enter integer quantity ≥ 1"
                    />
                  </div>

                  <div className="inventory-form-group">
                    <label>Adjustment Reason *</label>
                    <select
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      required
                    >
                      {activeModal.type === "topup" ? (
                        (reasons.topup_reasons?.length ? reasons.topup_reasons : [
                          { code: "stock_in", label: "Stock In / Delivery received" },
                          { code: "recount", label: "Recount correction" },
                          { code: "audit_correction", label: "Audit adjustment" },
                        ]).map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label} ({r.code})
                          </option>
                        ))
                      ) : (
                        (reasons.deduct_reasons?.length ? reasons.deduct_reasons : [
                          { code: "manual_deduct", label: "Manual deduction" },
                          { code: "damage", label: "Damage / Breakage" },
                          { code: "shrinkage", label: "Shrinkage / Lost" },
                          { code: "return_to_vendor", label: "Returned to vendor" },
                          { code: "audit_correction", label: "Audit adjustment" },
                        ]).map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label} ({r.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="inventory-form-group">
                    <label>Notes / Explanation (Optional)</label>
                    <textarea
                      rows="2"
                      placeholder="Add reference number, invoice details, or audit explanation..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>

                  {activeModal.type === "deduct" && (
                    <div className="inventory-override-box">
                      <label className="inventory-override-label">
                        <input
                          type="checkbox"
                          checked={formOverride}
                          onChange={(e) => setFormOverride(e.target.checked)}
                          disabled={!canApproveInventory}
                        />
                        <div>
                          <span>Force Deduction Override (Allows deducting when stock &lt; quantity)</span>
                          <div style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b", marginTop: "0.2rem" }}>
                            {canApproveInventory
                              ? "Stock will floor at 0. This override will be flagged in the audit log."
                              : "Note: You require 'inventory.approve' permission to use force override."}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  {canOverrideHint && (
                    <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#b91c1c", fontWeight: 600 }}>
                      Hint: Current stock ({activeModal.product.current_stock}) is less than requested ({formQty}). Check 'Force Deduction Override' above to proceed.
                    </p>
                  )}
                </div>

                <div className="inventory-modal-footer">
                  <button type="button" className="user-secondary-btn" onClick={closeModal} disabled={modalLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="user-primary-btn" disabled={modalLoading}>
                    {modalLoading ? "Saving…" : activeModal.type === "topup" ? "Add Stock" : "Deduct Stock"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
