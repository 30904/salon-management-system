import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import CrmPendingCredits from "./CrmPendingCredits.jsx";
import CrmInactiveCustomers from "./CrmInactiveCustomers.jsx";
import CrmWhatsAppOffers from "./CrmWhatsAppOffers.jsx";
import "./CrmHome.css";

const GENDER_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EMPTY_FORM = {
  name: "",
  phone: "",
  gender: "",
  tags: "",
  notes: "",
  dob: "",
  anniversary_date: "",
};

const SEARCH_DEBOUNCE_MS = 300;

function formatPhone(phone) {
  return phone ? String(phone) : "—";
}

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function genderLabel(value) {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label || value || "—";
}

function parseTagsInput(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((label) => ({ label, type: "manual" }));
}

function tagsToInput(tags = []) {
  return (tags || []).map((tag) => tag.label || tag).join(", ");
}

function customerToForm(customer) {
  if (!customer) return { ...EMPTY_FORM };
  return {
    name: customer.name || "",
    phone: customer.phone || "",
    gender: customer.gender || "",
    tags: tagsToInput(customer.tags),
    notes: customer.notes || "",
    dob: formatDateInput(customer.dob),
    anniversary_date: formatDateInput(customer.anniversary_date),
  };
}

function buildPayload(form) {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    gender: form.gender || null,
    tags: parseTagsInput(form.tags),
    notes: form.notes.trim() || null,
    dob: form.dob || null,
    anniversary_date: form.anniversary_date || null,
  };
}

function CustomerFormModal({ mode, form, busy, error, onChange, onClose, onSubmit }) {
  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="crm-modal-header">
          <div>
            <h2>{mode === "edit" ? "Edit customer" : "Add customer"}</h2>
            <p>Saved customers are stored in the database and available across bookings and billing.</p>
          </div>
          <button type="button" className="crm-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="crm-modal-body" onSubmit={onSubmit}>
          <div className="crm-form-grid">
            <label className="crm-field">
              Name *
              <input
                required
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="Customer full name"
              />
            </label>

            <label className="crm-field">
              Phone *
              <input
                required
                value={form.phone}
                onChange={(e) => onChange("phone", e.target.value)}
                placeholder="10-digit phone"
                inputMode="tel"
              />
            </label>

            <label className="crm-field">
              Gender
              <select value={form.gender} onChange={(e) => onChange("gender", e.target.value)}>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="crm-field">
              Tags
              <input
                value={form.tags}
                onChange={(e) => onChange("tags", e.target.value)}
                placeholder="VIP, bridal, regular (comma separated)"
              />
            </label>

            <label className="crm-field">
              Date of birth
              <input type="date" value={form.dob} onChange={(e) => onChange("dob", e.target.value)} />
            </label>

            <label className="crm-field">
              Anniversary
              <input
                type="date"
                value={form.anniversary_date}
                onChange={(e) => onChange("anniversary_date", e.target.value)}
              />
            </label>

            <label className="crm-field crm-field--full">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
                placeholder="Preferences, allergies, remarks…"
              />
            </label>
          </div>

          {error ? <p className="crm-form-error">{error}</p> : null}

          <div className="crm-modal-footer">
            <button type="button" className="crm-btn crm-btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="crm-btn crm-btn--primary" disabled={busy}>
              {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CrmHome() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("crm", "view");
  const canCreate = hasPermission("crm", "create");
  const canEdit = hasPermission("crm", "edit");
  const canDelete = hasPermission("crm", "delete");
  const canSendWhatsApp = hasPermission("crm", "create") || hasPermission("crm", "edit");

  const [activeTab, setActiveTab] = useState("customers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  async function fetchCustomersPage({ query = "", nextPage = 1, append = false }) {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await arnavApi.listCustomers({
        search: query?.trim() || undefined,
        page: nextPage,
      });
      if (!res.success) throw new Error(res.message || "Failed to load customers");

      const payload = res.data || {};
      const items = Array.isArray(payload.items) ? payload.items : [];

      setCustomers((prev) => (append ? [...prev, ...items] : items));
      setPage(Number(payload.page) || nextPage);
      setHasMore(Boolean(payload.hasMore));
      setTotal(Number(payload.total) || (append ? total : items.length));

      if (!append) {
        setAppliedSearch(query?.trim() || "");
      }
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || "Failed to load customers";
      if (append) {
        // eslint-disable-next-line no-alert
        alert(message);
      } else {
        setError(message);
        setCustomers([]);
        setPage(1);
        setHasMore(false);
        setTotal(0);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  const loadCustomers = (query = "") =>
    fetchCustomersPage({ query, nextPage: 1, append: false });

  function handleClearSearch() {
    setSearch("");
    if (appliedSearch !== "") {
      loadCustomers("");
    }
  }

  function handleSearchNow() {
    loadCustomers(search);
  }

  function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    fetchCustomersPage({
      query: appliedSearch,
      nextPage: page + 1,
      append: true,
    });
  }

  useEffect(() => {
    loadCustomers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === appliedSearch) return undefined;

    const timer = window.setTimeout(() => {
      loadCustomers(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, appliedSearch]);

  const rows = useMemo(() => customers, [customers]);

  function openCreateModal() {
    setModalMode("create");
    setEditingCustomer(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(customer) {
    setModalMode("edit");
    setEditingCustomer(customer);
    setForm(customerToForm(customer));
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (formBusy) return;
    setModalOpen(false);
    setEditingCustomer(null);
    setFormError(null);
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormBusy(true);
    setFormError(null);

    try {
      const payload = buildPayload(form);

      if (!payload.name || !payload.phone) {
        throw new Error("Name and phone are required");
      }

      const res =
        modalMode === "edit"
          ? await arnavApi.updateCustomer(editingCustomer.id || editingCustomer._id, payload)
          : await arnavApi.createCustomer(payload);

      if (!res.success) {
        throw new Error(res.message || "Save failed");
      }

      setModalOpen(false);
      setEditingCustomer(null);
      await loadCustomers(appliedSearch);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Save failed");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(customer) {
    const label = customer.name || customer.phone || "this customer";
    if (!window.confirm(`Delete customer "${label}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await arnavApi.deleteCustomer(customer.id || customer._id);
      if (!res.success) throw new Error(res.message || "Delete failed");
      await loadCustomers(appliedSearch);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.message || err.message || "Delete failed");
    }
  }

  if (!canView) {
    return (
      <div className="page access-denied-page">
        <div className="access-denied-card">
          <h1>Access denied</h1>
          <p className="page-note">You don’t have permission to view CRM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page crm-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>
            {activeTab === "whatsapp"
              ? "WhatsApp Offers"
              : activeTab === "pending-credits"
                ? "Pending Package Credits"
                : activeTab === "inactive"
                  ? "Inactive Customers"
                  : "Customers"}
          </h1>
          <p>
            {activeTab === "whatsapp"
              ? "Compose offer messages, open WhatsApp with them prefilled, and tap Send manually."
              : activeTab === "pending-credits"
                ? "See which customers still have unused package credits, and send a WhatsApp balance update."
                : activeTab === "inactive"
                  ? "Customers with no recent salon visit — adjust the day threshold to re-query."
                  : "Manage salon customers stored in the database. Used by bookings, billing, and packages."}
          </p>
        </div>

        <div className="module-hero-actions">
          {canEdit ? (
            <Link to="/crm/import" className="module-hero-btn">
              Import Customers
            </Link>
          ) : null}
          {activeTab === "customers" && canCreate ? (
            <button type="button" className="module-hero-btn" onClick={openCreateModal}>
              + Add customer
            </button>
          ) : null}
        </div>
      </header>

      <div className="crm-tabs">
        <button
          type="button"
          className={`crm-tab ${activeTab === "customers" ? "is-active" : ""}`}
          onClick={() => setActiveTab("customers")}
        >
          Customers
        </button>
        <button
          type="button"
          className={`crm-tab ${activeTab === "pending-credits" ? "is-active" : ""}`}
          onClick={() => setActiveTab("pending-credits")}
        >
          Pending Credits
        </button>
        <button
          type="button"
          className={`crm-tab ${activeTab === "inactive" ? "is-active" : ""}`}
          onClick={() => setActiveTab("inactive")}
        >
          Inactive Customers
        </button>
        {canSendWhatsApp && (
          <button
            type="button"
            className={`crm-tab ${activeTab === "whatsapp" ? "is-active" : ""}`}
            onClick={() => setActiveTab("whatsapp")}
          >
            WhatsApp Offers
          </button>
        )}
      </div>

      {activeTab === "whatsapp" ? (
        <CrmWhatsAppOffers />
      ) : activeTab === "pending-credits" ? (
        <CrmPendingCredits />
      ) : activeTab === "inactive" ? (
        <CrmInactiveCustomers />
      ) : (
        <>
      <section className="crm-toolbar">
        <label className="crm-search">
          Search customers
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchNow();
            }}
          />
        </label>
        <div className="crm-toolbar-actions">
          <button type="button" className="crm-btn crm-btn--secondary" onClick={handleSearchNow}>
            Search
          </button>
          <button type="button" className="crm-btn crm-btn--secondary" onClick={handleClearSearch}>
            Clear
          </button>
        </div>
      </section>

      {loading && <p>Loading customers…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && (
        <section className="crm-table-card">
          <div className="crm-table-toolbar">
            <strong>Total customers = {total}</strong>
            {appliedSearch ? (
              <span>
                Filtered by “{appliedSearch}” — showing {rows.length} loaded
              </span>
            ) : rows.length < total ? (
              <span>Showing {rows.length} of {total}</span>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="page-note">No customers found.</p>
          ) : (
            <>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Gender</th>
                    <th>Tags</th>
                    <th>DOB</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr key={customer.id || customer._id}>
                      <td>
                        <div className="crm-name-cell">
                          <strong>{customer.name || "—"}</strong>
                          <span>{formatDisplayDate(customer.created_at)}</span>
                        </div>
                      </td>
                      <td>{formatPhone(customer.phone)}</td>
                      <td>{genderLabel(customer.gender)}</td>
                      <td>
                        {customer.tags?.length ? (
                          <div className="crm-tags">
                            {customer.tags.map((tag) => (
                              <span key={tag.id || tag.label} className="crm-tag">
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{formatDisplayDate(customer.dob)}</td>
                      <td className="crm-notes-cell">{customer.notes || "—"}</td>
                      <td>
                        <div className="crm-row-actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="crm-btn crm-btn--secondary crm-btn--small"
                              onClick={() => openEditModal(customer)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="crm-btn crm-btn--danger crm-btn--small"
                              onClick={() => handleDelete(customer)}
                            >
                              Delete
                            </button>
                          )}
                          {!canEdit && !canDelete ? "—" : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore ? (
              <div className="crm-toolbar-actions" style={{ marginTop: "0.85rem" }}>
                <button
                  type="button"
                  className="crm-btn crm-btn--secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore || !hasMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
            </>
          )}
        </section>
      )}

      {modalOpen && (
        <CustomerFormModal
          mode={modalMode}
          form={form}
          busy={formBusy}
          error={formError}
          onChange={updateForm}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
        </>
      )}
    </div>
  );
}
