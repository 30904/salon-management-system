import { useEffect, useMemo, useState } from "react";
import { inventoryApi, productsApi } from "../api/index.js";
import { usePermission } from "../hooks/usePermission.js";
import { formatDateTime, formatInr } from "../utils/format.js";

const EMPTY_PRODUCT_FORM = {
  name: "",
  sku: "",
  unit: "piece",
  purchase_price: "",
  sale_price: "",
  current_stock: "0",
  reorder_level: "10",
};

function productId(product) {
  return product?.id || product?._id;
}

export default function Inventory() {
  const { hasPermission } = usePermission();
  const canEditInventory = hasPermission("inventory", "edit");
  const canApproveInventory = hasPermission("inventory", "approve");
  const canCreateProduct =
    hasPermission("inventory", "create") || hasPermission("settings", "create");
  const canEditProduct =
    hasPermission("inventory", "edit") || hasPermission("settings", "edit");
  const canDeleteProduct =
    hasPermission("inventory", "delete") || hasPermission("settings", "delete");

  const [activeTab, setActiveTab] = useState("kpis");

  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(null);
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportStockFilter, setReportStockFilter] = useState("all");
  const [reasons, setReasons] = useState({ deduct_reasons: [], topup_reasons: [] });

  const [productsList, setProductsList] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const [allLogs, setAllLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const logsLimit = 25;
  const [logsActionFilter, setLogsActionFilter] = useState("all");

  const [activeModal, setActiveModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [canOverrideHint, setCanOverrideHint] = useState(false);
  const [formQty, setFormQty] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOverride, setFormOverride] = useState(false);
  const [singleProductLogs, setSingleProductLogs] = useState([]);

  const [activeProductModal, setActiveProductModal] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productFormActive, setProductFormActive] = useState(true);
  const [productFormSaving, setProductFormSaving] = useState(false);
  const [productFormStatusUpdating, setProductFormStatusUpdating] = useState(false);
  const [productFormError, setProductFormError] = useState(null);

  const loadReportData = async (isRefresh = false) => {
    if (!isRefresh) setReportLoading(true);
    setReportError(null);
    try {
      const [reportRes, reasonsRes] = await Promise.all([
        inventoryApi.getStockReport(),
        inventoryApi
          .getAdjustmentReasons()
          .catch(() => ({ data: { deduct_reasons: [], topup_reasons: [] } })),
      ]);
      if (!reportRes.success) {
        throw new Error(reportRes.message || "Failed to load stock report");
      }
      setReportData(reportRes.data);
      if (reasonsRes?.data) setReasons(reasonsRes.data);
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
      if (productStockFilter === "low") params.low_stock = "true";
      const response = await productsApi.listProducts(params);
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
      const params = { page: logsPage, limit: logsLimit };
      if (logsActionFilter !== "all") params.action = logsActionFilter;
      const response = await inventoryApi.getAllAuditLogs(params);
      if (!response.success) {
        throw new Error(response.message || "Failed to load transactions");
      }
      setAllLogs(response.data || []);
      if (response.pagination) setLogsTotal(response.pagination.total || 0);
    } catch (err) {
      setLogsError(err.response?.data?.message || err.message);
    } finally {
      if (!isRefresh) setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  useEffect(() => {
    if (activeTab === "products") loadProductsMaster();
    else if (activeTab === "transactions") loadTransactionsLogs();
  }, [activeTab, productStatusFilter, productStockFilter, logsPage, logsActionFilter]);

  const summary = useMemo(
    () =>
      reportData?.summary || {
        total_products: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        total_stock_value_at_sale: 0,
      },
    [reportData]
  );

  const filteredReportProducts = useMemo(() => {
    if (!reportData?.products) return [];
    return reportData.products.filter((p) => {
      const q = reportSearchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q);
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
      return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    });
  }, [productsList, productSearchQuery]);

  const openModal = async (type, product) => {
    setActiveModal({ type, product });
    setModalError(null);
    setCanOverrideHint(false);
    setFormQty("");
    setFormNotes("");
    setFormOverride(false);
    setSingleProductLogs([]);

    if (type === "topup") {
      setFormReason(reasons.topup_reasons?.[0]?.code || "stock_in");
    } else if (type === "deduct") {
      setFormReason(reasons.deduct_reasons?.[0]?.code || "manual_deduct");
    } else if (type === "audit") {
      setModalLoading(true);
      try {
        const res = await inventoryApi.getProductAuditLog(productId(product));
        setSingleProductLogs(res.success ? res.data || [] : []);
      } catch (err) {
        setModalError(err.response?.data?.message || err.message);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSingleProductLogs([]);
  };

  const handleStockAdjustmentSubmit = async (event) => {
    event.preventDefault();
    setModalLoading(true);
    setModalError(null);
    setCanOverrideHint(false);
    try {
      const qty = parseInt(formQty, 10);
      if (Number.isNaN(qty) || qty <= 0) {
        throw new Error("Quantity must be a positive integer");
      }
      const payload = {
        quantity: qty,
        reason: formReason,
        notes: formNotes || undefined,
        force_override: formOverride,
      };
      const id = productId(activeModal.product);
      const res =
        activeModal.type === "topup"
          ? await inventoryApi.topUpStock(id, payload)
          : await inventoryApi.deductStock(id, payload);
      if (!res.success) throw new Error(res.message || "Adjustment failed");
      await Promise.all([
        loadReportData(true),
        activeTab === "products" ? loadProductsMaster(true) : null,
        activeTab === "transactions" ? loadTransactionsLogs(true) : null,
      ]);
      closeModal();
    } catch (err) {
      if (err.response?.data?.can_override) setCanOverrideHint(true);
      setModalError(err.response?.data?.message || err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const openProductModal = (mode, product = null) => {
    setProductFormError(null);
    setProductFormSaving(false);
    setProductFormStatusUpdating(false);
    if (mode === "edit" && product) {
      setActiveProductModal({ mode: "edit", id: productId(product), product });
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

  const closeProductModal = () => setActiveProductModal(null);

  const handleProductFormSubmit = async (event) => {
    event.preventDefault();
    setProductFormSaving(true);
    setProductFormError(null);
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
        if (!canEditProduct) throw new Error("No permission to edit products");
        res = await productsApi.updateProduct(activeProductModal.id, payload);
      } else {
        if (!canCreateProduct) throw new Error("No permission to create products");
        res = await productsApi.createProduct(payload);
      }
      if (!res.success) throw new Error(res.message || "Failed to save product");
      await Promise.all([loadReportData(true), loadProductsMaster(true)]);
      closeProductModal();
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
        ? await productsApi.deactivateProduct(activeProductModal.id)
        : await productsApi.updateProduct(activeProductModal.id, { is_active: true });
      if (!res.success) throw new Error(res.message || "Status toggle failed");
      setProductFormActive(Boolean(res.data?.is_active));
      loadProductsMaster(true);
      loadReportData(true);
    } catch (err) {
      setProductFormError(err.response?.data?.message || err.message);
    } finally {
      setProductFormStatusUpdating(false);
    }
  };

  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsLimit));
  const reasonOptions =
    activeModal?.type === "topup"
      ? reasons.topup_reasons || []
      : reasons.deduct_reasons || [];

  return (
    <div className="page-pad inventory-page">
      <header className="page-header-row">
        <h1>Inventory</h1>
      </header>

      <div className="segmented inventory-tabs" role="tablist" aria-label="Inventory tabs">
        <button
          type="button"
          className={activeTab === "kpis" ? "is-active" : ""}
          onClick={() => setActiveTab("kpis")}
        >
          Stock
        </button>
        <button
          type="button"
          className={activeTab === "transactions" ? "is-active" : ""}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
        <button
          type="button"
          className={activeTab === "products" ? "is-active" : ""}
          onClick={() => setActiveTab("products")}
        >
          Products
        </button>
      </div>

      {activeTab === "kpis" && (
        <section className="inventory-section">
          {reportLoading && <p>Loading…</p>}
          {reportError && <p className="form-error">{reportError}</p>}

          {!reportLoading && !reportError && (
            <>
              <div className="stat-grid inventory-kpi-grid">
                <div className="stat-tile">
                  <span className="muted">Products</span>
                  <strong>{summary.total_products || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span className="muted">Low stock</span>
                  <strong>{summary.low_stock_count || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span className="muted">Out of stock</span>
                  <strong>{summary.out_of_stock_count || 0}</strong>
                </div>
                <div className="stat-tile">
                  <span className="muted">Retail value</span>
                  <strong>{formatInr(summary.total_stock_value_at_sale || 0)}</strong>
                </div>
              </div>

              <input
                className="inventory-search"
                type="search"
                placeholder="Search name or SKU"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
              />

              <div className="segmented inventory-filter-chips">
                {[
                  ["all", "All"],
                  ["low", "Low"],
                  ["out", "Out"],
                  ["in", "In stock"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={reportStockFilter === value ? "is-active" : ""}
                    onClick={() => setReportStockFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filteredReportProducts.length === 0 ? (
                <p className="muted">No products match this filter.</p>
              ) : (
                <ul className="inventory-list">
                  {filteredReportProducts.map((product) => (
                    <li key={productId(product)} className="status-card inventory-item">
                      <div className="inventory-item-head">
                        <div>
                          <strong>{product.name}</strong>
                          <p className="muted">{product.sku}</p>
                        </div>
                        <span
                          className={`status-pill inventory-stock-pill ${
                            product.is_low_stock || product.status === "out_of_stock"
                              ? "is-low"
                              : "is-ok"
                          }`}
                        >
                          {product.current_stock} {product.unit || ""}
                        </span>
                      </div>
                      <p className="muted">
                        Reorder {product.reorder_level ?? "—"} ·{" "}
                        {formatInr(product.total_purchase_value || product.purchase_price || 0)}
                      </p>
                      {canEditInventory && (
                        <div className="inventory-item-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => openModal("topup", product)}
                          >
                            Top-up
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openModal("deduct", product)}
                          >
                            Deduct
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openModal("audit", product)}
                          >
                            Audit
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === "transactions" && (
        <section className="inventory-section">
          <div className="segmented inventory-filter-chips">
            {[
              ["all", "All"],
              ["stock_top_up", "Top-ups"],
              ["stock_deduct", "Deductions"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={logsActionFilter === value ? "is-active" : ""}
                onClick={() => {
                  setLogsPage(1);
                  setLogsActionFilter(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {logsLoading && <p>Loading…</p>}
          {logsError && <p className="form-error">{logsError}</p>}

          {!logsLoading && !logsError && allLogs.length === 0 && (
            <p className="muted">No stock movements yet.</p>
          )}

          {!logsLoading && !logsError && allLogs.length > 0 && (
            <ul className="inventory-list">
              {allLogs.map((log) => {
                const details = log.details || {};
                const delta = Number(details.delta ?? details.quantity_change ?? details.quantity ?? 0);
                const isAddition = delta > 0 || String(log.action || "").includes("top_up");
                return (
                  <li key={log.id || log._id} className="status-card inventory-log-item">
                    <div className="inventory-item-head">
                      <strong>{details.product_name || log.product_name || "Product"}</strong>
                      <span className={`status-pill ${isAddition ? "is-ok" : "is-low"}`}>
                        {isAddition ? `+${Math.abs(delta) || "—"}` : `-${Math.abs(delta) || "—"}`}
                      </span>
                    </div>
                    <p className="muted">
                      {log.action || "movement"} · {formatDateTime(log.timestamp || log.createdAt || log.created_at)}
                    </p>
                    {details.reason && <p className="muted">Reason: {details.reason}</p>}
                    {details.notes && <p className="muted">{details.notes}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {logsTotalPages > 1 && (
            <div className="inventory-pagination">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={logsPage <= 1}
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="muted">
                Page {logsPage} / {logsTotalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={logsPage >= logsTotalPages}
                onClick={() => setLogsPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === "products" && (
        <section className="inventory-section">
          <div className="inventory-products-toolbar">
            {canCreateProduct && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => openProductModal("create")}
              >
                Add product
              </button>
            )}
          </div>

          <input
            className="inventory-search"
            type="search"
            placeholder="Search products"
            value={productSearchQuery}
            onChange={(e) => setProductSearchQuery(e.target.value)}
          />

          <div className="segmented inventory-filter-chips">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={productStatusFilter === value ? "is-active" : ""}
                onClick={() => setProductStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="segmented inventory-filter-chips">
            {[
              ["all", "Any stock"],
              ["low", "Low stock"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={productStockFilter === value ? "is-active" : ""}
                onClick={() => setProductStockFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {productsLoading && <p>Loading…</p>}
          {productsError && <p className="form-error">{productsError}</p>}

          {!productsLoading && !productsError && filteredMasterProducts.length === 0 && (
            <p className="muted">No products found.</p>
          )}

          {!productsLoading && !productsError && filteredMasterProducts.length > 0 && (
            <ul className="inventory-list">
              {filteredMasterProducts.map((product) => (
                <li key={productId(product)} className="status-card inventory-item">
                  <div className="inventory-item-head">
                    <div>
                      <strong>{product.name}</strong>
                      <p className="muted">{product.sku}</p>
                    </div>
                    <span className={`status-pill ${product.is_active ? "is-ok" : "is-low"}`}>
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="muted">
                    Stock {product.current_stock ?? 0} · Buy {formatInr(product.purchase_price)} ·
                    Sell {formatInr(product.sale_price)}
                  </p>
                  <div className="inventory-item-actions">
                    {canEditProduct && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openProductModal("edit", product)}
                      >
                        Edit
                      </button>
                    )}
                    {canEditInventory && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => openModal("topup", product)}
                        >
                          Top-up
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openModal("deduct", product)}
                        >
                          Deduct
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeModal && (activeModal.type === "topup" || activeModal.type === "deduct") && (
        <div className="inventory-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {activeModal.type === "topup" ? "Top-up" : "Deduct"} · {activeModal.product?.name}
            </h2>
            <form className="inventory-modal-form" onSubmit={handleStockAdjustmentSubmit}>
              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <select value={formReason} onChange={(e) => setFormReason(e.target.value)}>
                  {reasonOptions.length === 0 && <option value={formReason}>{formReason}</option>}
                  {reasonOptions.map((reason) => (
                    <option key={reason.code || reason} value={reason.code || reason}>
                      {reason.label || reason.code || reason}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              {canOverrideHint && canApproveInventory && (
                <label className="inventory-override">
                  <input
                    type="checkbox"
                    checked={formOverride}
                    onChange={(e) => setFormOverride(e.target.checked)}
                  />
                  Force override (approve)
                </label>
              )}
              {modalError && <p className="form-error">{modalError}</p>}
              <div className="inventory-item-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal?.type === "audit" && (
        <div className="inventory-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Audit · {activeModal.product?.name}</h2>
            {modalLoading && <p>Loading…</p>}
            {modalError && <p className="form-error">{modalError}</p>}
            {!modalLoading && singleProductLogs.length === 0 && (
              <p className="muted">No audit entries for this product.</p>
            )}
            <ul className="inventory-list">
              {singleProductLogs.map((log) => (
                <li key={log.id || log._id} className="inventory-log-item">
                  <strong>{log.action || "movement"}</strong>
                  <p className="muted">
                    Qty {log.quantity ?? log.qty_change ?? "—"} ·{" "}
                    {formatDateTime(log.createdAt || log.created_at)}
                  </p>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-secondary btn-block" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {activeProductModal && (
        <div className="inventory-modal-backdrop" role="presentation" onClick={closeProductModal}>
          <div
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{activeProductModal.mode === "edit" ? "Edit product" : "Add product"}</h2>
            <form className="inventory-modal-form" onSubmit={handleProductFormSubmit}>
              <label className="field">
                <span>Name</span>
                <input
                  value={productForm.name}
                  onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>SKU</span>
                <input
                  value={productForm.sku}
                  onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Unit</span>
                <input
                  value={productForm.unit}
                  onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Purchase price</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.purchase_price}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, purchase_price: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Sale price</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.sale_price}
                  onChange={(e) => setProductForm((p) => ({ ...p, sale_price: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Current stock</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.current_stock}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, current_stock: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Reorder level</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.reorder_level}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, reorder_level: e.target.value }))
                  }
                />
              </label>

              {activeProductModal.mode === "edit" && canDeleteProduct && (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  disabled={productFormStatusUpdating}
                  onClick={handleProductStatusToggle}
                >
                  {productFormStatusUpdating
                    ? "Updating…"
                    : productFormActive
                      ? "Deactivate product"
                      : "Activate product"}
                </button>
              )}

              {productFormError && <p className="form-error">{productFormError}</p>}

              <div className="inventory-item-actions">
                <button type="button" className="btn btn-secondary" onClick={closeProductModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={productFormSaving}>
                  {productFormSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
