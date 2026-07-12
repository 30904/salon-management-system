import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const APPLIES_TO_OPTIONS = [
  { value: "service", label: "Services only" },
  { value: "product", label: "Products only" },
  { value: "both", label: "Services and products" },
];

const EMPTY_FORM = {
  name: "",
  rate: "",
  applies_to: "service",
};

export default function TaxForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const [form, setForm] = useState(EMPTY_FORM);
  const [isActive, setIsActive] = useState(true);
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
          const response = await arnavApi.getTax(id);

          if (!response.success) {
            throw new Error(response.message || "Failed to load tax rate");
          }

          if (cancelled) return;

          const tax = response.data;
          setForm({
            name: tax.name || "",
            rate: String(tax.rate ?? ""),
            applies_to: tax.applies_to || "service",
          });
          setIsActive(Boolean(tax.is_active));
        } else {
          setForm(EMPTY_FORM);
          setIsActive(true);
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
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      rate: Number(form.rate),
      applies_to: form.applies_to,
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
          throw new Error("You do not have permission to edit tax rates");
        }

        const response = await arnavApi.updateTax(id, buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Update failed");
        }

        setSuccess("Tax rate updated");
        setIsActive(Boolean(response.data.is_active));
      } else {
        if (!canCreate) {
          throw new Error("You do not have permission to create tax rates");
        }

        const response = await arnavApi.createTax(buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Create failed");
        }

        navigate(`/settings/tax/${response.data.id}/edit`, {
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
        ? await arnavApi.deactivateTax(id)
        : await arnavApi.updateTax(id, { is_active: true });

      if (!response.success) {
        throw new Error(response.message || "Status update failed");
      }

      setIsActive(Boolean(response.data.is_active));
      setSuccess(
        response.data.is_active ? "Tax rate activated" : "Tax rate deactivated"
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
        <p>Loading tax form…</p>
      </div>
    );
  }

  return (
    <div className="page tax-form-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>{isEdit ? "Edit tax rate" : "Create tax rate"}</h1>
          <p className="page-description">
            Set GST rate and whether it applies to services, products, or both.
          </p>
        </div>

        <Link to="/settings/tax" className="user-secondary-btn">
          Back to tax rates
        </Link>
      </header>

      {error && <p className="status-error">{error}</p>}
      {success && <p className="user-success-text">{success}</p>}

      <form className="status-card user-form-card" onSubmit={handleSubmit}>
        <label>
          Tax name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            maxLength={120}
            placeholder="e.g. GST 18% Services"
          />
        </label>

        <label>
          Rate (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.rate}
            onChange={(event) => updateField("rate", event.target.value)}
            required
            placeholder="18"
          />
        </label>

        <label>
          Applies to
          <select
            value={form.applies_to}
            onChange={(event) => updateField("applies_to", event.target.value)}
            required
          >
            {APPLIES_TO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="page-note">
          Billing uses service rates for service lines and product rates for
          retail lines. &quot;Both&quot; applies to every line type.
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create tax rate"}
          </button>
        </div>
      </form>
    </div>
  );
}
