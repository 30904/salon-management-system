import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { preciousApi, arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import { formatInr } from "../../utils/earningsFormat.js";
import KpiCard from "../../components/dashboard/KpiCard.jsx";

const EMPTY_PRODUCT_FORM = {
  name: "",
  sku: "",
  unit: "piece",
  purchase_price: "",
  sale_price: "",
  current_stock: "0",
  reorder_level: "10",
};

export default function StockOverview() {
  const { hasPermission } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "kpis"; // "kpis" | "transactions" | "products"
  const editParamId = searchParams.get("editId");
  const actionParam = searchParams.get("action");

  // Permissions
  const canEditInventory = hasPermission("inventory", "edit");
  const canApproveInventory = hasPermission("inventory", "approve");
  const canEditSettings = hasPermission("settings", "edit") || hasPermission("settings", "view");
  const canCreateSettings = hasPermission("settings", "create");
  const canDeleteSettings = hasPermission("settings", "delete");

  // ─── TAB 1: KPIs & Stock Report State ─────────────────────────────────────────
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(null);
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportStockFilter, setReportStockFilter] = useState("all"); // "all" | "low" | "out" | "in"
  const [reasons, setReasons] = useState({ deduct_reasons: [], topup_reasons: [] });

  // ─── TAB 2: Product Master State ──────────────────────────────────────────────
  const [productsList, setProductsList] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productStatusFilter, setProductStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [productStockFilter, setProductStockFilter] = useState("all"); // "all" | "low"
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // Integrated Product Form Modal State
  const [activeProductModal, setActiveProductModal] = useState(null); // null | { mode: "create" } | { mode: "edit", product }
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productFormActive, setProductFormActive] = useState(true);
  const [productFormSaving, setProductFormSaving] = useState(false);
  const [productFormStatusUpdating, setProductFormStatusUpdating] = useState(false);
  const [productFormError, setProductFormError] = useState(null);
  const [productFormSuccess, setProductFormSuccess] = useState(null);

  // ─── TAB 3: Transactions & Audit Log State ─────────────────────────────────────
  const [allLogs, setAllLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLimit] = useState(25);
  const [logsActionFilter, setLogsActionFilter] = useState("all");
  const [logsProductFilter, setLogsProductFilter] = useState("");
  const [logsSearchQuery, setLogsSearchQuery] = useState("");

  // ─── Modals State (Top-Up, Deduct, Single-Product Audit) ────────────────────────
  const [activeModal, setActiveModal] = useState(null); // { type: "topup" | "deduct" | "audit", product }
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [canOverrideHint, setCanOverrideHint] = useState(false);
  const [formQty, setFormQty] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOverride, setFormOverride] = useState(false);
  const [singleProductLogs, setSingleProductLogs] = useState([]);

  // ─── Switch Tab Helper ────────────────────────────────────────────────────────
  const switchTab = (tabName, extra = {}) => {
    const nextParams = { tab: tabName };
    if (extra.editId) nextParams.editId = extra.editId;
    if (extra.action) nextParams.action = extra.action;
    setSearchParams(nextParams);
  };

  // ─── Data Loading Functions ───────────────────────────────────────────────────
  const loadReportData = async (isRefresh = false) => {
    if (!isRefresh) setReportLoading(true);
    setReportError(null);
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
      setReportError(err.response?.data?.message || err.message);
    } finally {
      if (!isRefresh) setReportLoading(false);
    }
  };

  const loadProductsMaster = async (isRefresh = false) => {
    if (!isRefresh) setProductsLoading(true);
    setProductsError(null);
    try {
      const params = {};
      if (productStatusFilter !== "all") {
        params.is_active = productStatusFilter === "active" ? "true" : "false";
      }
      if (productStockFilter === "low") {
        params.low_stock = "true";
      }
      const response = await arnavApi.listProducts(params);
      if (!response.success) {
        throw new Error(response.message || "Failed to load products");
      }
      setProductsList(response.data || []);
    } catch (err) {
      setProductsError(err.response?.data?.message || err.message);
    } finally {
      if (!isRefresh) setProductsLoading(false);
    }
  };

  const loadTransactionsLogs = async (isRefresh = false) => {
    if (!isRefresh) setLogsLoading(true);
    setLogsError(null);
    try {
      const params = {
        page: logsPage,
        limit: logsLimit,
      };
      if (logsActionFilter !== "all") params.action = logsActionFilter;
      if (logsProductFilter) params.product_id = logsProductFilter;
      if (logsSearchQuery.trim()) params.search = logsSearchQuery.trim();

      const response = await preciousApi.getAllAuditLogs(params);
      if (!response.success) {
        throw new Error(response.message || "Failed to load transactions audit log");
      }
      setAllLogs(response.data || []);
      if (response.pagination) {
        setLogsTotal(response.pagination.total || 0);
      }
    } catch (err) {
      setLogsError(err.response?.data?.message || err.message);
    } finally {
      if (!isRefresh) setLogsLoading(false);
    }
  };

  // Initial & Tab-driven effects
  useEffect(() => {
    loadReportData();
  }, []);

  useEffect(() => {
    if (activeTab === "products") {
      loadProductsMaster();
    } else if (activeTab === "transactions") {
      loadTransactionsLogs();
    }
  }, [activeTab, productStatusFilter, productStockFilter, logsPage, logsActionFilter, logsProductFilter]);

  // Handle auto-opening product edit or create from URL params (`?editId=123` or `?action=new`)
  useEffect(() => {
    if (activeTab === "products" && editParamId) {
      arnavApi.getProduct(editParamId).then((res) => {
        if (res.success && res.data) {
          openProductModal("edit", res.data);
        }
      }).catch(console.error);
    } else if (activeTab === "products" && actionParam === "new") {
      openProductModal("create");
    }
  }, [activeTab, editParamId, actionParam]);

  // ─── Filtered Data Memos ──────────────────────────────────────────────────────
  const summary = useMemo(() => {
    return reportData?.summary || {
      total_products: 0,
      total_stock_units: 0,
      total_stock_value_at_purchase: 0,
      total_stock_value_at_sale: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      reorder_alerts_count: 0,
    };
  }, [reportData]);

  const alerts = useMemo(() => {
    return reportData?.reorder_alerts || [];
  }, [reportData]);

  const filteredReportProducts = useMemo(() => {
    if (!reportData?.products) return [];
    return reportData.products.filter((p) => {
      const q = reportSearchQuery.toLowerCase().trim();
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (reportStockFilter === "low") return p.is_low_stock;
      if (reportStockFilter === "out") return p.status === "out_of_stock";
      if (reportStockFilter === "in") return p.status === "in_stock";
      return true;
    });
  }, [reportData, reportSearchQuery, reportStockFilter]);

  const filteredMasterProducts = useMemo(() => {
    if (!productsList) return [];
    return productsList.filter((p) => {
      const q = productSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [productsList, productSearchQuery]);

  // ─── Stock Top-Up / Deduct / Audit Modals Handlers ─────────────────────────────
  const openModal = async (type, product) => {
    setActiveModal({ type, product });
    setModalError(null);
    setCanOverrideHint(false);
    setFormQty("");
    setFormNotes("");
    setFormOverride(false);

    if (type === "topup") {
      const defaultReason = reasons.topup_reasons?.[0]?.code || "stock_in";
      setFormReason(defaultReason);
    } else if (type === "deduct") {
      const defaultReason = reasons.deduct_reasons?.[0]?.code || "manual_deduct";
      setFormReason(defaultReason);
    } else if (type === "audit") {
      setModalLoading(true);
      try {
        const res = await preciousApi.getProductAuditLog(product.id);
        setSingleProductLogs(res.success ? res.data : []);
      } catch (err) {
        setModalError(err.message || "Failed to load audit history");
      } finally {
        setModalLoading(false);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSingleProductLogs([]);
  };

  const handleStockAdjustmentSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    setCanOverrideHint(false);

    try {
      const qty = parseInt(formQty, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Quantity must be a positive integer greater than 0");
      }

      const payload = {
        quantity: qty,
        reason: formReason,
        notes: formNotes || undefined,
        force_override: formOverride,
      };

      let res;
      if (activeModal.type === "topup") {
        res = await preciousApi.topUpStock(activeModal.product.id, payload);
      } else {
        res = await preciousApi.deductStock(activeModal.product.id, payload);
      }

      if (!res.success) {
        throw new Error(res.message || "Adjustment failed");
      }

      // Reload report and master data
      await Promise.all([
        loadReportData(true),
        activeTab === "products" && loadProductsMaster(true),
        activeTab === "transactions" && loadTransactionsLogs(true),
      ]);
      closeModal();
    } catch (err) {
      if (err.response?.data?.can_override) {
        setCanOverrideHint(true);
      }
      setModalError(err.response?.data?.message || err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // ─── Integrated Product Master Form Handlers ──────────────────────────────────
  const openProductModal = (mode, product = null) => {
    setProductFormError(null);
    setProductFormSuccess(null);
    setProductFormSaving(false);
    setProductFormStatusUpdating(false);

    if (mode === "edit" && product) {
      setActiveProductModal({ mode: "edit", id: product.id, product });
      setProductForm({
        name: product.name || "",
        sku: product.sku || "",
        unit: product.unit || "piece",
        purchase_price: String(product.purchase_price ?? ""),
        sale_price: String(product.sale_price ?? ""),
        current_stock: String(product.current_stock ?? 0),
        reorder_level: String(product.reorder_level ?? 0),
      });
      setProductFormActive(Boolean(product.is_active));
    } else {
      setActiveProductModal({ mode: "create" });
      setProductForm(EMPTY_PRODUCT_FORM);
      setProductFormActive(true);
    }
  };

  const closeProductModal = () => {
    setActiveProductModal(null);
    if (editParamId || actionParam) {
      switchTab("products");
    }
  };

  const updateProductFormField = (field, value) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    setProductFormSaving(true);
    setProductFormError(null);
    setProductFormSuccess(null);

    try {
      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim(),
        unit: productForm.unit.trim(),
        purchase_price: Number(productForm.purchase_price) || 0,
        sale_price: Number(productForm.sale_price) || 0,
        current_stock: Number(productForm.current_stock) || 0,
        reorder_level: Number(productForm.reorder_level) || 0,
      };

      if (!payload.name || !payload.sku) {
        throw new Error("Product name and SKU are required");
      }

      let res;
      if (activeProductModal.mode === "edit") {
        if (!canEditSettings) throw new Error("No permission to edit products");
        res = await arnavApi.updateProduct(activeProductModal.id, payload);
      } else {
        if (!canCreateSettings) throw new Error("No permission to create products");
        res = await arnavApi.createProduct(payload);
      }

      if (!res.success) {
        throw new Error(res.message || "Failed to save product");
      }

      setProductFormSuccess(`Product successfully ${activeProductModal.mode === "edit" ? "updated" : "created"}!`);
      
      // Refresh inventory and products lists
      await Promise.all([
        loadReportData(true),
        loadProductsMaster(true),
      ]);

      setTimeout(() => {
        closeProductModal();
      }, 1000);
    } catch (err) {
      setProductFormError(err.response?.data?.message || err.message);
    } finally {
      setProductFormSaving(false);
    }
  };

  const handleProductStatusToggle = async () => {
    if (activeProductModal?.mode !== "edit") return;
    setProductFormStatusUpdating(true);
    setProductFormError(null);
    try {
      const res = productFormActive
        ? await arnavApi.deactivateProduct(activeProductModal.id)
        : await arnavApi.updateProduct(activeProductModal.id, { is_active: true });

      if (!res.success) throw new Error(res.message || "Status toggle failed");
      setProductFormActive(Boolean(res.data.is_active));
      setProductFormSuccess(`Product marked as ${res.data.is_active ? "Active" : "Inactive"}`);
      loadProductsMaster(true);
      loadReportData(true);
    } catch (err) {
      setProductFormError(err.response?.data?.message || err.message);
    } finally {
      setProductFormStatusUpdating(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="inventory-page">
      {/* Page Header Area (Green Hero Banner) */}
      <header className="inventory-hero-header">
        <div>
          <h1>Inventory management</h1>
          <p>
            Monitor stock metrics, review transaction logs, and manage catalog thresholds.
          </p>
        </div>

        {activeTab === "products" && canCreateSettings && (
          <button
            type="button"
            onClick={() => openProductModal("create")}
            style={{
              background: "#ffffff",
              color: "#0f766e",
              border: "none",
              padding: "0.65rem 1.35rem",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
            }}
          >
            + Add Product
          </button>
        )}
      </header>

      {/* Segmented Toggle Navigation Bar */}
      <div className="inventory-tabs-nav" role="tablist" aria-label="Inventory Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "kpis"}
          className={`inventory-tab-btn ${activeTab === "kpis" ? "active" : ""}`}
          onClick={() => switchTab("kpis")}
        >
          <span>Stock Overview</span>
          {alerts.length > 0 && (
            <span className="inventory-tab-badge danger">{alerts.length} Alerts</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "transactions"}
          className={`inventory-tab-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => switchTab("transactions")}
        >
          <span>Transactions</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "products"}
          className={`inventory-tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => switchTab("products")}
        >
          <span>Product Master</span>
          <span className="inventory-tab-badge">{summary.total_products || productsList.length}</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: KPI OVERVIEW
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "kpis" && (
        <>
          {reportLoading ? (
            <p className="page-note">Loading stock metrics & KPIs…</p>
          ) : reportError ? (
            <div className="status-error">{reportError}</div>
          ) : (
            <>
              {/* Dashboard KpiCard Grid */}
              <section className="kpi-grid" aria-label="Key stock metrics">
                <div onClick={() => switchTab("products")} style={{ cursor: "pointer", display: "contents" }}>
                  <KpiCard
                    label="Catalog Products"
                    value={summary.total_products || 0}
                    period="Active items in catalog"
                    tone="primary"
                    icon="inventory"
                    format="number"
                  />
                </div>

                <div onClick={() => setReportStockFilter("out")} style={{ cursor: "pointer", display: "contents" }}>
                  <KpiCard
                    label="Out of Stock"
                    value={summary.out_of_stock_count || 0}
                    period="Immediate restock required"
                    tone={summary.out_of_stock_count > 0 ? "danger" : "neutral"}
                    icon="inventory"
                    format="number"
                  />
                </div>

                <div onClick={() => setReportStockFilter("low")} style={{ cursor: "pointer", display: "contents" }}>
                  <KpiCard
                    label="Low Stock Alerts"
                    value={summary.low_stock_count || 0}
                    period="At or below threshold"
                    tone={summary.low_stock_count > 0 ? "warning" : "info"}
                    icon="inventory"
                    format="number"
                  />
                </div>

                <div style={{ display: "contents" }}>
                  <KpiCard
                    label="Stock Valuation (Cost)"
                    value={summary.total_stock_value_at_purchase || 0}
                    period={`Retail Value: ${formatInr(summary.total_stock_value_at_sale || 0)}`}
                    tone="success"
                    icon="sales"
                    format="currency"
                  />
                </div>
              </section>

              {/* Full Stock Inventory Table */}
              <section className="status-card user-table-card" style={{ background: "#ffffff", borderRadius: "18px", border: "1px solid #e8edf3", padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                  <div className="user-filter-row" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className={`user-filter-btn ${reportStockFilter === "all" ? "active" : ""}`}
                      onClick={() => setReportStockFilter("all")}
                    >
                      All Products ({reportData.products.length})
                    </button>
                    <button
                      type="button"
                      className={`user-filter-btn ${reportStockFilter === "low" ? "active" : ""}`}
                      onClick={() => setReportStockFilter("low")}
                    >
                      Low Stock ({alerts.length})
                    </button>
                    <button
                      type="button"
                      className={`user-filter-btn ${reportStockFilter === "out" ? "active" : ""}`}
                      onClick={() => setReportStockFilter("out")}
                    >
                      Out of Stock ({summary.out_of_stock_count})
                    </button>
                    <button
                      type="button"
                      className={`user-filter-btn ${reportStockFilter === "in" ? "active" : ""}`}
                      onClick={() => setReportStockFilter("in")}
                    >
                      In Stock ({reportData.products.length - alerts.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search products or SKU..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    style={{ padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", width: "260px", flex: "1 1 200px", maxWidth: "340px" }}
                  />
                </div>

                {filteredReportProducts.length === 0 ? (
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
                        {filteredReportProducts.map((p) => (
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
                                  <button
                                    type="button"
                                    className="user-secondary-btn"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#f8fafc" }}
                                    onClick={() => switchTab("products", { editId: p.id })}
                                  >
                                    Edit
                                  </button>
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: STOCK TRANSACTIONS & AUDIT LOG
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "transactions" && (
        <section className="status-card user-table-card" style={{ background: "#ffffff", borderRadius: "18px", border: "1px solid #e8edf3", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div className="user-filter-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`user-filter-btn ${logsActionFilter === "all" ? "active" : ""}`}
                onClick={() => setLogsActionFilter("all")}
              >
                All Movements
              </button>
              <button
                type="button"
                className={`user-filter-btn ${logsActionFilter === "stock_top_up" ? "active" : ""}`}
                onClick={() => setLogsActionFilter("stock_top_up")}
              >
                Top-Ups
              </button>
              <button
                type="button"
                className={`user-filter-btn ${logsActionFilter === "stock_deduct" ? "active" : ""}`}
                onClick={() => setLogsActionFilter("stock_deduct")}
              >
                Deductions
              </button>
            </div>

            <select
              value={logsProductFilter}
              onChange={(e) => { setLogsProductFilter(e.target.value); setLogsPage(1); }}
              style={{ padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", background: "#ffffff", color: "#334155" }}
            >
              <option value="">All Products</option>
              {(reportData?.products || productsList || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search logs, SKU, reason, notes..."
              value={logsSearchQuery}
              onChange={(e) => { setLogsSearchQuery(e.target.value); setLogsPage(1); }}
              style={{ padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", width: "260px", flex: "1 1 200px", maxWidth: "340px" }}
            />

            <button
              type="button"
              className="user-secondary-btn"
              style={{ padding: "0.5rem 0.95rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}
              onClick={() => loadTransactionsLogs(true)}
            >
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <p className="page-note">Loading stock movement logs…</p>
          ) : logsError ? (
            <div className="status-error">{logsError}</div>
          ) : allLogs.length === 0 ? (
            <p className="page-note">No recorded transactions or stock adjustments found.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {allLogs.map((log) => {
                  const details = log.details || {};
                  const delta = Number(details.delta ?? details.quantity_change ?? 0);
                  const isAddition = delta > 0 || log.action?.includes("top_up");
                  return (
                    <div
                      key={log.id}
                      className={`inventory-log-item ${details.override_used ? "override" : isAddition ? "addition" : "deduction"}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
                            {details.product_name || `Product ID: ${log.entity_id}`}
                          </strong>
                          {details.sku && <span style={{ fontSize: "0.8rem", color: "#64748b", background: "#f1f5f9", padding: "0.1rem 0.5rem", borderRadius: "6px" }}>SKU: {details.sku}</span>}
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "6px",
                            background: isAddition ? "#ecfdf5" : "#fef2f2",
                            color: isAddition ? "#059669" : "#dc2626"
                          }}>
                            {isAddition ? `+${delta || Math.abs(details.quantity || 0)} Units Added` : `${delta || `-${details.quantity || 0}`} Units Deducted`}
                          </span>
                          {details.override_used && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "6px", background: "#fef3c7", color: "#d97706" }}>
                              Force Override Used
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                          <span>Stock Level: <strong style={{ color: "#1e293b" }}>{details.stock_before ?? "?"} → {details.stock_after ?? "?"}</strong></span>
                          <span style={{ margin: "0 0.5rem", color: "#cbd5e1" }}>|</span>
                          <span>Reason: <strong style={{ color: "#334155" }}>{details.reason || log.action}</strong></span>
                        </div>

                        {details.notes && (
                          <div style={{ fontSize: "0.825rem", color: "#64748b", fontStyle: "italic" }}>
                            Notes: "{details.notes}"
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right", fontSize: "0.785rem", color: "#64748b", flexShrink: 0 }}>
                        <div style={{ fontWeight: 600, color: "#334155" }}>
                          By: {log.user?.name || "System Staff"}
                        </div>
                        <div style={{ marginTop: "0.2rem" }}>
                          {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Showing {(logsPage - 1) * logsLimit + 1} to {Math.min(logsPage * logsLimit, logsTotal)} of {logsTotal} entries
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="user-secondary-btn"
                    disabled={logsPage <= 1}
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="user-secondary-btn"
                    disabled={logsPage * logsLimit >= logsTotal}
                    onClick={() => setLogsPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 3: INTEGRATED PRODUCT MASTER SETTINGS
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "products" && (
        <section className="status-card user-table-card" style={{ background: "#ffffff", borderRadius: "18px", border: "1px solid #e8edf3", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div className="user-filter-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`user-filter-btn ${productStatusFilter === "all" ? "active" : ""}`}
                onClick={() => setProductStatusFilter("all")}
              >
                All Status
              </button>
              <button
                type="button"
                className={`user-filter-btn ${productStatusFilter === "active" ? "active" : ""}`}
                onClick={() => setProductStatusFilter("active")}
              >
                Active Only
              </button>
              <button
                type="button"
                className={`user-filter-btn ${productStatusFilter === "inactive" ? "active" : ""}`}
                onClick={() => setProductStatusFilter("inactive")}
              >
                Inactive Only
              </button>
            </div>

            <div className="user-filter-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`user-filter-btn ${productStockFilter === "all" ? "active" : ""}`}
                onClick={() => setProductStockFilter("all")}
              >
                All Stock
              </button>
              <button
                type="button"
                className={`user-filter-btn ${productStockFilter === "low" ? "active" : ""}`}
                onClick={() => setProductStockFilter("low")}
              >
                Low Stock
              </button>
            </div>

            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              style={{ padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", width: "260px", flex: "1 1 200px", maxWidth: "340px" }}
            />

            <button
              type="button"
              className="user-secondary-btn"
              style={{ padding: "0.5rem 0.95rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}
              onClick={() => loadProductsMaster(true)}
            >
              Refresh
            </button>
          </div>

          {productsLoading ? (
            <p className="page-note">Loading product master catalog…</p>
          ) : productsError ? (
            <div className="status-error">{productsError}</div>
          ) : filteredMasterProducts.length === 0 ? (
            <p className="page-note">No products found matching your search or filters.</p>
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Unit</th>
                    <th>Current Stock</th>
                    <th>Reorder Threshold</th>
                    <th>Purchase Price</th>
                    <th>Sale Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td><code>{p.sku}</code></td>
                      <td>{p.unit}</td>
                      <td>
                        <span className={`product-stock-pill ${p.is_low_stock ? "low" : "ok"}`}>
                          {p.current_stock}
                        </span>
                      </td>
                      <td>{p.reorder_level}</td>
                      <td>{formatInr(p.purchase_price)}</td>
                      <td>{formatInr(p.sale_price)}</td>
                      <td>
                        <span className={`user-status-pill ${p.is_active ? "active" : "inactive"}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          {canEditSettings && (
                            <button
                              type="button"
                              className="user-secondary-btn"
                              style={{ padding: "0.35rem 0.7rem", fontSize: "0.785rem", fontWeight: 600 }}
                              onClick={() => openProductModal("edit", p)}
                            >
                              Edit Settings
                            </button>
                          )}
                          {canEditInventory && p.is_active && (
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          INTEGRATED PRODUCT FORM MODAL / DRAWER
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeProductModal && (
        <div className="inventory-modal-backdrop" onClick={closeProductModal}>
          <div className="inventory-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
            <div className="inventory-modal-header">
              <h3>
                {activeProductModal.mode === "edit" ? `Edit Product — ${productForm.name}` : "Create New Product"}
              </h3>
              <button type="button" className="inventory-modal-close" onClick={closeProductModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleProductFormSubmit}>
              <div className="inventory-modal-body">
                {productFormError && <div className="status-error">{productFormError}</div>}
                {productFormSuccess && <div className="user-success-box" style={{ padding: "0.75rem 1rem", background: "#ecfdf5", color: "#065f46", borderRadius: "10px", fontWeight: 600 }}>{productFormSuccess}</div>}

                <div className="inventory-form-grid">
                  <div className="inventory-form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. L'Oreal Keratin Shampoo 500ml"
                      value={productForm.name}
                      onChange={(e) => updateProductFormField("name", e.target.value)}
                      disabled={productFormSaving}
                    />
                  </div>

                  <div className="inventory-form-group">
                    <label>SKU / Barcode *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LOR-KER-500"
                      value={productForm.sku}
                      onChange={(e) => updateProductFormField("sku", e.target.value)}
                      disabled={productFormSaving}
                    />
                  </div>
                </div>

                <div className="inventory-form-grid">
                  <div className="inventory-form-group">
                    <label>Unit of Measurement *</label>
                    <select
                      value={productForm.unit}
                      onChange={(e) => updateProductFormField("unit", e.target.value)}
                      disabled={productFormSaving}
                    >
                      <option value="piece">Piece (pc)</option>
                      <option value="ml">Milliliters (ml)</option>
                      <option value="gram">Grams (g)</option>
                      <option value="bottle">Bottle</option>
                      <option value="pack">Pack / Box</option>
                      <option value="kit">Kit / Combo</option>
                    </select>
                  </div>

                  <div className="inventory-form-group">
                    <label>Reorder Alert Threshold *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="Low stock warning below..."
                      value={productForm.reorder_level}
                      onChange={(e) => updateProductFormField("reorder_level", e.target.value)}
                      disabled={productFormSaving}
                    />
                  </div>
                </div>

                <div className="inventory-form-grid">
                  <div className="inventory-form-group">
                    <label>Purchase Cost Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={productForm.purchase_price}
                      onChange={(e) => updateProductFormField("purchase_price", e.target.value)}
                      disabled={productFormSaving}
                    />
                  </div>

                  <div className="inventory-form-group">
                    <label>Retail Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={productForm.sale_price}
                      onChange={(e) => updateProductFormField("sale_price", e.target.value)}
                      disabled={productFormSaving}
                    />
                  </div>
                </div>

                {activeProductModal.mode === "create" && (
                  <div className="inventory-form-group">
                    <label>Initial Opening Stock (Units)</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.current_stock}
                      onChange={(e) => updateProductFormField("current_stock", e.target.value)}
                      disabled={productFormSaving}
                    />
                    <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                      Initial stock when registering this product. Subsequent adjustments will be logged via Top-Up or Deduct.
                    </small>
                  </div>
                )}

                {activeProductModal.mode === "edit" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", background: "#f8fafc", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                    <div>
                      <strong style={{ fontSize: "0.9rem", color: "#0f172a" }}>Product Catalog Status</strong>
                      <div style={{ fontSize: "0.785rem", color: "#64748b" }}>
                        {productFormActive ? "Product is currently available across POS and inventory." : "Product is deactivated and hidden from active billing."}
                      </div>
                    </div>
                    {(canEditSettings || canDeleteSettings) && (
                      <button
                        type="button"
                        className={`user-status-pill ${productFormActive ? "active" : "inactive"}`}
                        style={{ border: "none", cursor: "pointer", padding: "0.45rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}
                        onClick={handleProductStatusToggle}
                        disabled={productFormStatusUpdating}
                      >
                        {productFormStatusUpdating ? "Updating…" : productFormActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="inventory-modal-footer">
                <button type="button" className="user-secondary-btn" onClick={closeProductModal} disabled={productFormSaving}>
                  Cancel
                </button>
                <button type="submit" className="user-primary-btn" disabled={productFormSaving || (!canEditSettings && activeProductModal.mode === "edit") || (!canCreateSettings && activeProductModal.mode === "create")}>
                  {productFormSaving ? "Saving Product…" : activeProductModal.mode === "edit" ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          STOCK ADJUSTMENT MODALS (Top-Up, Deduct, Single Audit)
      ══════════════════════════════════════════════════════════════════════════ */}
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
              <div className="inventory-modal-body" style={{ maxHeight: "450px", overflowY: "auto" }}>
                {modalLoading ? (
                  <p>Loading audit trail…</p>
                ) : modalError ? (
                  <div className="status-error">{modalError}</div>
                ) : singleProductLogs.length === 0 ? (
                  <p className="page-note">No recorded stock movement history for this product yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {singleProductLogs.map((log) => {
                      const details = log.details || {};
                      const isAddition = (details.delta > 0) || (details.quantity_change > 0) || log.action?.includes("top_up");
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
                              {isAddition ? "Top Up" : "Deduction"}: {Math.abs(details.delta || details.quantity_change || details.quantity || 0)} {activeModal.product.unit}(s)
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
                            <div>{new Date(log.timestamp || log.created_at).toLocaleDateString()}</div>
                            <div>{new Date(log.timestamp || log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            <div style={{ fontWeight: 600, color: "#334155", marginTop: "0.2rem" }}>
                              By: {log.user?.name || log.user_name || "System"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleStockAdjustmentSubmit}>
                <div className="inventory-modal-body">
                  {modalError && <div className="status-error">{modalError}</div>}

                  <div className="inventory-form-group">
                    <label>Current Stock Available</label>
                    <div style={{ padding: "0.6rem 0.85rem", background: "#f1f5f9", borderRadius: "8px", fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
                      {activeModal.product.current_stock} {activeModal.product.unit}(s)
                    </div>
                  </div>

                  <div className="inventory-form-group">
                    <label>
                      {activeModal.type === "topup" ? "Quantity to Add (Units)" : "Quantity to Deduct (Units)"} *
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
                      placeholder="Add reference invoice number, vendor details, or audit explanation..."
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
                    <p style={{ marginTop: "0.5rem", fontSize: "0.825rem", color: "#dc2626", fontWeight: 600 }}>
                      Hint: Current stock ({activeModal.product.current_stock}) is less than requested ({formQty}). Check 'Force Deduction Override' above to proceed.
                    </p>
                  )}
                </div>

                <div className="inventory-modal-footer">
                  <button type="button" className="user-secondary-btn" onClick={closeModal} disabled={modalLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="user-primary-btn" disabled={modalLoading}>
                    {modalLoading ? "Processing…" : activeModal.type === "topup" ? "Add Stock" : "Deduct Stock"}
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
