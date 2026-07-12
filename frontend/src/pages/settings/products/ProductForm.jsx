import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const EMPTY_FORM = {
  name: "",
  sku: "",
  unit: "piece",
  purchase_price: "",
  sale_price: "",
  current_stock: "0",
  reorder_level: "0",
};

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const [form, setForm] = useState(EMPTY_FORM);
  const [isActive, setIsActive] = useState(true);
  const [isLowStock, setIsLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canEdit = hasPermission("settings", "edit");
  const canCreate = hasPermission("settings", "create");
  const canDelete = hasPermission("settings", "delete");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (isEdit) {
          const response = await arnavApi.getProduct(id);

          if (!response.success) {
            throw new Error(response.message || "Failed to load product");
          }

          if (cancelled) return;

          const product = response.data;
          setForm({
            name: product.name || "",
            sku: product.sku || "",
            unit: product.unit || "piece",
            purchase_price: String(product.purchase_price ?? ""),
            sale_price: String(product.sale_price ?? ""),
            current_stock: String(product.current_stock ?? 0),
            reorder_level: String(product.reorder_level ?? 0),
          });
          setIsActive(Boolean(product.is_active));
          setIsLowStock(Boolean(product.is_low_stock));
        } else {
          setForm(EMPTY_FORM);
          setIsActive(true);
          setIsLowStock(false);
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
  }, [id, isEdit]);

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "current_stock" || field === "reorder_level") {
        const stock = Number(field === "current_stock" ? value : next.current_stock);
        const reorder = Number(
          field === "reorder_level" ? value : next.reorder_level
        );

        if (Number.isFinite(stock) && Number.isFinite(reorder)) {
          setIsLowStock(stock <= reorder);
        }
      }

      return next;
    });
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      sku: form.sku.trim(),
      unit: form.unit.trim(),
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
      current_stock: Number(form.current_stock),
      reorder_level: Number(form.reorder_level),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEdit) {
        if (!canEdit) {
          throw new Error("You do not have permission to edit products");
        }

        const response = await arnavApi.updateProduct(id, buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Update failed");
        }

        setSuccess("Product updated");
        setIsActive(Boolean(response.data.is_active));
        setIsLowStock(Boolean(response.data.is_low_stock));
      } else {
        if (!canCreate) {
          throw new Error("You do not have permission to create products");
        }

        const response = await arnavApi.createProduct(buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Create failed");
        }

        navigate(`/settings/products/${response.data.id}/edit`, {
          replace: true,
        });
        return;
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!isEdit || (!canEdit && !canDelete)) {
      return;
    }

    setStatusUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = isActive
        ? await arnavApi.deactivateProduct(id)
        : await arnavApi.updateProduct(id, { is_active: true });

      if (!response.success) {
        throw new Error(response.message || "Status update failed");
      }

      setIsActive(Boolean(response.data.is_active));
      setSuccess(
        response.data.is_active ? "Product activated" : "Product deactivated"
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading product form…</p>
      </div>
    );
  }

  return (
    <div className="page product-form-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>{isEdit ? "Edit product" : "Create product"}</h1>
          <p className="page-description">
            Set SKU, pricing, current stock, and reorder level for retail items.
          </p>
        </div>

        <Link to="/settings/products" className="user-secondary-btn">
          Back to products
        </Link>
      </header>

      {error && <p className="status-error">{error}</p>}
      {success && <p className="user-success-text">{success}</p>}

      {isEdit && isActive && isLowStock && (
        <p className="product-low-stock-note">
          Current stock is at or below the reorder level.
        </p>
      )}

      <form className="status-card user-form-card" onSubmit={handleSubmit}>
        <label>
          Product name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            maxLength={160}
            placeholder="e.g. Professional Shampoo 250ml"
          />
        </label>

        <label>
          SKU
          <input
            type="text"
            value={form.sku}
            onChange={(event) => updateField("sku", event.target.value)}
            required
            maxLength={64}
            placeholder="PRD-SH-250"
          />
        </label>

        <label>
          Unit
          <input
            type="text"
            value={form.unit}
            onChange={(event) => updateField("unit", event.target.value)}
            required
            maxLength={32}
            placeholder="bottle, piece, pack"
          />
        </label>

        <label>
          Purchase price (₹)
          <input
            type="number"
            min="0"
            step="1"
            value={form.purchase_price}
            onChange={(event) => updateField("purchase_price", event.target.value)}
            required
          />
        </label>

        <label>
          Sale price (₹)
          <input
            type="number"
            min="0"
            step="1"
            value={form.sale_price}
            onChange={(event) => updateField("sale_price", event.target.value)}
            required
          />
        </label>

        <label>
          Current stock
          <input
            type="number"
            min="0"
            step="1"
            value={form.current_stock}
            onChange={(event) => updateField("current_stock", event.target.value)}
            required
          />
        </label>

        <label>
          Reorder level
          <input
            type="number"
            min="0"
            step="1"
            value={form.reorder_level}
            onChange={(event) => updateField("reorder_level", event.target.value)}
            required
          />
        </label>
        <p className="page-note">
          Dashboard low-stock alerts trigger when current stock is less than or
          equal to reorder level.
        </p>

        {isEdit && (
          <div className="user-status-row">
            <div>
              <p className="user-summary-label">Status</p>
              <span
                className={`user-status-pill ${isActive ? "active" : "inactive"}`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {(canEdit || canDelete) && (
              <button
                type="button"
                className={isActive ? "user-danger-btn" : "user-primary-btn"}
                onClick={handleToggleActive}
                disabled={statusUpdating}
              >
                {statusUpdating
                  ? "Updating…"
                  : isActive
                    ? "Deactivate"
                    : "Activate"}
              </button>
            )}
          </div>
        )}

        <div className="user-form-actions">
          <button
            type="submit"
            className="user-primary-btn"
            disabled={saving || (isEdit ? !canEdit : !canCreate)}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>
    </div>
  );
}
