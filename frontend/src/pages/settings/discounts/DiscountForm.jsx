import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { arnavApi } from "../../../api";
import { usePermission } from "../../../hooks/usePermission.js";

const WEEK_DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const EMPTY_FORM = {
  name: "",
  percent: "",
  days: [1, 2, 3, 4, 5, 6, 7],
  start_time: "10:00",
  end_time: "19:00",
};

export default function DiscountForm() {
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
          const response = await arnavApi.getDiscount(id);
          if (!response.success) {
            throw new Error(response.message || "Failed to load discount type");
          }
          if (cancelled) return;
          const discount = response.data;
          setForm({
            name: discount.name || "",
            percent: String(discount.percent ?? ""),
            days: Array.isArray(discount.days) && discount.days.length ? discount.days : EMPTY_FORM.days,
            start_time: discount.start_time || "10:00",
            end_time: discount.end_time || "19:00",
          });
          setIsActive(Boolean(discount.is_active));
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

  function toggleDay(day) {
    setForm((prev) => {
      const hasDay = prev.days.includes(day);
      const days = hasDay ? prev.days.filter((value) => value !== day) : [...prev.days, day].sort((a, b) => a - b);
      return { ...prev, days };
    });
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      percent: Number(form.percent),
      days: form.days,
      start_time: form.start_time,
      end_time: form.end_time,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (form.days.length === 0) {
        throw new Error("Select at least one weekday");
      }

      if (isEdit) {
        if (!canEdit) throw new Error("You do not have permission to edit discount types");
        const response = await arnavApi.updateDiscount(id, buildPayload());
        if (!response.success) throw new Error(response.message || "Update failed");
        setSuccess("Discount type updated");
        setIsActive(Boolean(response.data.is_active));
      } else {
        if (!canCreate) throw new Error("You do not have permission to create discount types");
        const response = await arnavApi.createDiscount(buildPayload());
        if (!response.success) throw new Error(response.message || "Create failed");
        navigate(`/settings/discounts/${response.data.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!isEdit || (!canEdit && !canDelete)) return;

    setStatusUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = isActive
        ? await arnavApi.deactivateDiscount(id)
        : await arnavApi.updateDiscount(id, { is_active: true });
      if (!response.success) throw new Error(response.message || "Status update failed");
      setIsActive(Boolean(response.data.is_active));
      setSuccess(response.data.is_active ? "Discount type activated" : "Discount type deactivated");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading discount form…</p>
      </div>
    );
  }

  return (
    <div className="page discount-form-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>{isEdit ? "Edit discount type" : "Create discount type"}</h1>
          <p>Set the percent, weekdays, and hours this discount can be used on billing.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/settings/discounts" className="module-hero-btn">
            Back to discount types
          </Link>
        </div>
      </header>

      {error ? <p className="status-error">{error}</p> : null}
      {success ? <p className="user-success-text">{success}</p> : null}

      <form className="module-panel user-form-card" onSubmit={handleSubmit}>
        <label>
          Discount type name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Weekday lunch 10%"
          />
        </label>

        <label>
          Discount percent (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.percent}
            onChange={(event) => updateField("percent", event.target.value)}
            required
            placeholder="10"
          />
        </label>

        <fieldset className="discount-day-fieldset">
          <legend>Available days</legend>
          <div className="discount-day-grid">
            {WEEK_DAYS.map((day) => (
              <label key={day.value} className="discount-day-chip">
                <input
                  type="checkbox"
                  checked={form.days.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="discount-time-row">
          <label>
            Start time
            <input
              type="time"
              value={form.start_time}
              onChange={(event) => updateField("start_time", event.target.value)}
              required
            />
          </label>
          <label>
            End time
            <input
              type="time"
              value={form.end_time}
              onChange={(event) => updateField("end_time", event.target.value)}
              required
            />
          </label>
        </div>
        <p className="page-note">
          Billing only offers this type when today is one of the selected days and the current salon time
          (Asia/Kolkata) is inside the window.
        </p>

        {isEdit ? (
          <div className="user-status-row">
            <div>
              <p className="user-summary-label">Status</p>
              <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
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
                {statusUpdating ? "Updating…" : isActive ? "Deactivate" : "Activate"}
              </button>
            )}
          </div>
        ) : null}

        <div className="user-form-actions">
          <button
            type="submit"
            className="user-primary-btn user-primary-btn--hero"
            disabled={saving || (isEdit ? !canEdit : !canCreate)}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create discount type"}
          </button>
        </div>
      </form>
    </div>
  );
}
