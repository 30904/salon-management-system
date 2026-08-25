import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { arnavApi, preciousApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function productId(product) {
  return String(product?.id || product?._id || "");
}

function unitCost(product) {
  const n = Number(product?.purchase_price ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Feature 4 — complete approved redo visits (billing.edit).
 * Reuses PosScreen catalog search / qty controls for products used.
 */
export default function RedoComplete() {
  const { hasPermission } = usePermission();
  const canComplete = hasPermission("billing", "edit");

  const [approved, setApproved] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [usedLines, setUsedLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => approved.find((row) => String(row.id) === String(selectedId)) || null,
    [approved, selectedId]
  );

  const estimatedCost = useMemo(
    () =>
      usedLines.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0),
        0
      ),
    [usedLines]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [products, searchQuery]);

  const loadApproved = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const res = await preciousApi.listRedoRequests({
        status: "approved",
        limit: 100,
      });
      if (!res?.success && !res?.data) {
        throw new Error(res?.message || "Failed to load approved redo requests");
      }
      const items = res.data?.items || [];
      setApproved(items);
      setSelectedId((prev) => {
        if (prev && items.some((row) => String(row.id) === String(prev))) return prev;
        return items[0] ? String(items[0].id) : "";
      });
    } catch (err) {
      setApproved([]);
      setSelectedId("");
      setError(
        err.response?.data?.message || err.message || "Failed to load approved redo requests"
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadApproved();
  }, [loadApproved]);

  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const res = await arnavApi.listProducts({ is_active: true });
        setProducts(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  useEffect(() => {
    setUsedLines([]);
    setSearchQuery("");
  }, [selectedId]);

  function addProduct(product) {
    const id = productId(product);
    if (!id) return;
    const stock = Number(product.current_stock || 0);
    if (stock <= 0) {
      setError(`"${product.name}" is out of stock.`);
      return;
    }
    setError("");
    setUsedLines((prev) => {
      const existing = prev.find((line) => line.product_id === id);
      if (existing) {
        if (existing.quantity >= stock) {
          setError(`Cannot exceed available stock (${stock}) for ${product.name}.`);
          return prev;
        }
        return prev.map((line) =>
          line.product_id === id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [
        ...prev,
        {
          product_id: id,
          item_name: product.name || "Product",
          sku: product.sku || "",
          unit_cost: unitCost(product),
          quantity: 1,
          max_stock: stock,
        },
      ];
    });
  }

  function updateQty(productIdValue, nextQty) {
    setUsedLines((prev) =>
      prev
        .map((line) => {
          if (line.product_id !== productIdValue) return line;
          const qty = Number(nextQty);
          if (!Number.isInteger(qty) || qty < 1) return null;
          if (qty > (line.max_stock || 0)) {
            setError(`Cannot exceed available stock (${line.max_stock}) for ${line.item_name}.`);
            return line;
          }
          setError("");
          return { ...line, quantity: qty };
        })
        .filter(Boolean)
    );
  }

  function removeLine(productIdValue) {
    setUsedLines((prev) => prev.filter((line) => line.product_id !== productIdValue));
  }

  async function handleComplete() {
    if (!selected || !canComplete) return;
    const confirmed = window.confirm(
      usedLines.length === 0
        ? "Complete this redo with no products (₹0 payroll cost)?"
        : `Complete redo and deduct ${formatCost(estimatedCost)} product cost from ${selected.redo_staff_name || "redo staff"} on next payroll?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const res = await preciousApi.completeRedoRequest(selected.id, {
        products_used: usedLines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
        })),
      });
      if (!res?.success && !res?.data) {
        throw new Error(res?.message || "Failed to complete redo");
      }
      const invoiceId = res.data?.redo_invoice?.id;
      const cost = res.data?.redo_request?.total_product_cost ?? estimatedCost;
      setNotice(
        invoiceId
          ? `Redo completed. Free invoice created (${formatCost(cost)} product cost recorded).`
          : `Redo completed. Product cost recorded: ${formatCost(cost)}.`
      );
      setUsedLines([]);
      await loadApproved();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to complete redo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page tax-list-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Complete redo visit</h1>
          <p>
            Record products used on an approved redo. Customer stays ₹0; product cost hits the redo
            stylist on payroll when the deduction gate is on.
          </p>
        </div>
        <div className="module-hero-actions">
          <Link to="/redo/request" className="module-hero-btn">
            Request redo
          </Link>
          <Link to="/redo/approvals" className="module-hero-btn">
            Redo approvals
          </Link>
          <Link to="/billing" className="module-hero-btn">
            Back to billing
          </Link>
          <button
            type="button"
            className="module-hero-btn"
            onClick={loadApproved}
            disabled={loadingList}
          >
            {loadingList ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {notice ? <p className="user-success-text">{notice}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      {!canComplete ? (
        <p className="page-note">Completing a redo requires billing edit permission.</p>
      ) : null}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Approved queue</span>
          <strong>{loadingList ? "…" : approved.length}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Products on this visit</span>
          <strong>{usedLines.length}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Est. payroll cost</span>
          <strong>{formatCost(estimatedCost)}</strong>
        </div>
      </section>

      <section className="status-card user-table-card">
        <h2 className="redo-page-title">Approved requests</h2>
        {loadingList ? <p>Loading approved redos…</p> : null}
        {!loadingList && approved.length === 0 ? (
          <p className="page-note">
            No approved redos waiting. Approve a request first from{" "}
            <Link to="/redo/approvals">Redo approvals</Link>.
          </p>
        ) : null}
        {!loadingList && approved.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th />
                  <th>Approved</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Invoice</th>
                  <th>Redo staff</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((row) => {
                  const id = String(row.id);
                  const isSelected = id === String(selectedId);
                  return (
                    <tr
                      key={id}
                      className={isSelected ? "redo-row-selected" : undefined}
                      onClick={() => setSelectedId(id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <input
                          type="radio"
                          name="redo-complete-select"
                          checked={isSelected}
                          onChange={() => setSelectedId(id)}
                          aria-label={`Select redo ${row.service_name || id}`}
                        />
                      </td>
                      <td>{formatWhen(row.approved_at || row.updated_at || row.created_at)}</td>
                      <td>
                        <strong>{row.customer_name || "—"}</strong>
                      </td>
                      <td>{row.service_name || "Service"}</td>
                      <td>
                        {row.original_invoice_id ? (
                          <Link
                            to={`/invoices/${row.original_invoice_id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.invoice_number || "Invoice"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div>{row.redo_staff_name || "—"}</div>
                        {row.redo_staff_designation ? (
                          <small className="redo-meta-text">{row.redo_staff_designation}</small>
                        ) : null}
                      </td>
                      <td>{row.reason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="redo-complete-layout">
          <section className="status-card user-table-card redo-complete-panel">
            <h2 className="redo-page-title">Products used</h2>
            <p className="page-note" style={{ marginTop: 0 }}>
              Same catalog search as POS. Cost uses purchase price × qty (payroll deduction target:{" "}
              <strong>{selected.redo_staff_name || "redo staff"}</strong>).
            </p>

            <div className="pos-search-bar">
              <input
                type="text"
                placeholder="Search by name or SKU…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!canComplete}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="pos-clear-search"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              ) : null}
            </div>

            {loadingCatalog ? (
              <div className="pos-catalog-loading">Loading products…</div>
            ) : filteredProducts.length === 0 ? (
              <div className="pos-catalog-empty">
                {searchQuery
                  ? `No matching products for "${searchQuery}".`
                  : "No active products in catalog."}
              </div>
            ) : (
              <div className="pos-items-grid">
                {filteredProducts.map((product) => {
                  const id = productId(product);
                  const stock = Number(product.current_stock || 0);
                  const out = stock <= 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`pos-item-card ${out ? "out-of-stock" : ""}`}
                      disabled={!canComplete || out || submitting}
                      onClick={() => addProduct(product)}
                    >
                      <div className="pos-item-card__top">
                        <span className="pos-item-type">Product</span>
                        <span className={`product-stock-pill ${out ? "low" : "ok"}`}>
                          {out ? "Out of stock" : `Stock ${stock}`}
                        </span>
                      </div>
                      <strong className="pos-item-card__name">{product.name}</strong>
                      <div className="pos-item-card__meta">
                        <span>SKU: {product.sku || "N/A"}</span>
                        <span>Cost {formatCost(unitCost(product))}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="status-card user-table-card redo-complete-panel">
            <h2 className="redo-page-title">This redo visit</h2>
            <p className="page-note" style={{ marginTop: 0 }}>
              <strong>{selected.service_name || "Service"}</strong>
              {" · "}
              {selected.customer_name || "Customer"}
            </p>

            {usedLines.length === 0 ? (
              <p className="page-note">
                No products yet — you can still complete as a service-only redo (₹0 cost).
              </p>
            ) : (
              <div className="pos-cart-list">
                {usedLines.map((line) => (
                  <div key={line.product_id} className="pos-cart-row">
                    <div className="pos-cart-row__top">
                      <div>
                        <span className="pos-cart-row__type">PRODUCT</span>
                        <strong className="pos-cart-row__name">{line.item_name}</strong>
                      </div>
                      <button
                        type="button"
                        className="pos-cart-row__delete"
                        onClick={() => removeLine(line.product_id)}
                        disabled={submitting}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="pos-cart-row__middle">
                      <div className="pos-qty-control">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            if (line.quantity > 1) updateQty(line.product_id, line.quantity - 1);
                            else removeLine(line.product_id);
                          }}
                        >
                          −
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            if (line.quantity >= (line.max_stock || 0)) {
                              setError(
                                `Cannot exceed available stock (${line.max_stock}) for ${line.item_name}.`
                              );
                              return;
                            }
                            updateQty(line.product_id, line.quantity + 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div className="pos-item-price-calc">
                        <small>
                          {formatCost(line.unit_cost)} × {line.quantity}
                        </small>
                        <strong>{formatCost(line.unit_cost * line.quantity)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="redo-complete-footer">
              <div className="redo-complete-total">
                <span>Est. payroll deduction</span>
                <strong>{formatCost(estimatedCost)}</strong>
              </div>
              <p className="page-note" style={{ margin: 0 }}>
                Deduction applies on the next payroll run only after the Feature 4 gate is enabled.
              </p>
              <button
                type="button"
                className="user-primary-btn user-primary-btn--hero"
                disabled={!canComplete || submitting}
                onClick={handleComplete}
              >
                {submitting ? "Completing…" : "Complete redo visit"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
