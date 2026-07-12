import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const EMPTY_FORM = {
  category_id: "",
  name: "",
  duration_minutes: "30",
  price: "",
  commission_slab_override_id: "",
};

export default function ServiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const [categories, setCategories] = useState([]);
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
        const categoriesResponse = await arnavApi.listServiceCategories({
          is_active: "true",
        });

        if (!categoriesResponse.success) {
          throw new Error(
            categoriesResponse.message || "Failed to load categories"
          );
        }

        if (cancelled) return;

        let loadedCategories = categoriesResponse.data || [];

        if (isEdit) {
          const serviceResponse = await arnavApi.getService(id);

          if (!serviceResponse.success) {
            throw new Error(serviceResponse.message || "Failed to load service");
          }

          if (cancelled) return;

          const service = serviceResponse.data;
          const categoryId = String(service.category?.id || service.category_id || "");

          if (
            categoryId &&
            !loadedCategories.some((category) => String(category.id) === categoryId)
          ) {
            const categoryResponse = await arnavApi.getServiceCategory(categoryId);
            if (categoryResponse.success && categoryResponse.data) {
              loadedCategories = [...loadedCategories, categoryResponse.data];
            }
          }

          setForm({
            category_id: categoryId,
            name: service.name || "",
            duration_minutes: String(service.duration_minutes ?? 30),
            price: String(service.price ?? ""),
            commission_slab_override_id: service.commission_slab_override_id
              ? String(service.commission_slab_override_id)
              : "",
          });
          setIsActive(Boolean(service.is_active));
        } else {
          setForm(EMPTY_FORM);
          setIsActive(true);
        }

        setCategories(loadedCategories);
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
      category_id: form.category_id,
      name: form.name.trim(),
      duration_minutes: Number(form.duration_minutes),
      price: Number(form.price),
      commission_slab_override_id: form.commission_slab_override_id.trim()
        ? form.commission_slab_override_id.trim()
        : null,
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
          throw new Error("You do not have permission to edit services");
        }

        const response = await arnavApi.updateService(id, buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Update failed");
        }

        setSuccess("Service updated");
        setIsActive(Boolean(response.data.is_active));
      } else {
        if (!canCreate) {
          throw new Error("You do not have permission to create services");
        }

        const response = await arnavApi.createService(buildPayload());

        if (!response.success) {
          throw new Error(response.message || "Create failed");
        }

        navigate(`/settings/services/${response.data.id}/edit`, {
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
        ? await arnavApi.deactivateService(id)
        : await arnavApi.updateService(id, { is_active: true });

      if (!response.success) {
        throw new Error(response.message || "Status update failed");
      }

      setIsActive(Boolean(response.data.is_active));
      setSuccess(
        response.data.is_active ? "Service activated" : "Service deactivated"
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
        <p>Loading service form…</p>
      </div>
    );
  }

  return (
    <div className="page service-form-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Settings</p>
          <h1>{isEdit ? "Edit service" : "Create service"}</h1>
          <p className="page-description">
            Set category, duration, price, and optional commission slab override.
          </p>
        </div>

        <Link to="/settings/services" className="user-secondary-btn">
          Back to services
        </Link>
      </header>

      {error && <p className="status-error">{error}</p>}
      {success && <p className="user-success-text">{success}</p>}

      <form className="status-card user-form-card" onSubmit={handleSubmit}>
        <label>
          Category
          <select
            value={form.category_id}
            onChange={(event) => updateField("category_id", event.target.value)}
            required
          >
            <option value="" disabled>
              Select category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {categories.length === 0 && (
          <p className="page-note">
            No active categories yet. Create one from the Services list first.
          </p>
        )}

        <label>
          Service name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            maxLength={160}
            placeholder="e.g. Women's Haircut"
          />
        </label>

        <label>
          Duration (minutes)
          <input
            type="number"
            min="5"
            step="1"
            value={form.duration_minutes}
            onChange={(event) =>
              updateField("duration_minutes", event.target.value)
            }
            required
          />
        </label>

        <label>
          Price (₹)
          <input
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            required
            placeholder="500"
          />
        </label>

        <label>
          Commission slab override ID (optional)
          <input
            type="text"
            value={form.commission_slab_override_id}
            onChange={(event) =>
              updateField("commission_slab_override_id", event.target.value)
            }
            placeholder="Leave blank to use staff default slab"
          />
        </label>
        <p className="page-note">
          Slab picker UI arrives when CommissionSlab master (Precious) is ready.
          Paste an ObjectId only if you need a service-specific override.
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create service"}
          </button>
        </div>
      </form>
    </div>
  );
}
