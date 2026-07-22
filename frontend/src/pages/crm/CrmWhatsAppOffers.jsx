import { useEffect, useMemo, useState } from "react";
import {
  fetchWhatsAppTemplates,
  listWhatsAppCampaigns,
  previewWhatsAppCampaign,
  sendWhatsAppCampaign,
} from "../../api/whatsappApi.js";

const CAMPAIGN_TYPES = [
  { value: "offer", label: "Offer" },
  { value: "sale", label: "Sale / Promo" },
  { value: "announcement", label: "Announcement" },
  { value: "custom", label: "Custom" },
];

const EMPTY_FORM = {
  title: "",
  campaign_type: "offer",
  message_body: "",
  template_id: "",
  audience: "all",
};

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CrmWhatsAppOffers({ customers = [] }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedIds, setSelectedIds] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const selectableCustomers = useMemo(
    () => customers.filter((customer) => customer.phone),
    [customers]
  );

  async function loadPanel() {
    setLoading(true);
    setError(null);
    try {
      const [templateRes, campaignRes, previewRes] = await Promise.all([
        fetchWhatsAppTemplates({ is_active: "true" }).catch(() => ({ data: [] })),
        listWhatsAppCampaigns({ limit: 20 }),
        previewWhatsAppCampaign({ audience: "all" }),
      ]);

      setTemplates(templateRes?.data || []);
      setCampaigns(campaignRes?.data || []);
      setPreview(previewRes?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load WhatsApp panel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPanel();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshPreview() {
      try {
        const params =
          form.audience === "selected"
            ? { audience: "selected", customer_ids: selectedIds.join(",") }
            : { audience: "all" };
        const res = await previewWhatsAppCampaign(params);
        if (!cancelled) setPreview(res?.data || null);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }

    refreshPreview();
    return () => {
      cancelled = true;
    };
  }, [form.audience, selectedIds]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyTemplate(templateId) {
    updateField("template_id", templateId);
    const template = templates.find((row) => String(row.id || row._id) === String(templateId));
    if (!template) return;
    updateField("title", template.name || form.title);
    updateField("message_body", template.message_body || "");
  }

  function toggleCustomer(customerId) {
    const id = String(customerId);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }

  function selectAllVisible() {
    setSelectedIds(selectableCustomers.map((customer) => String(customer.id || customer._id)));
  }

  async function handleSend(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: form.title.trim(),
        campaign_type: form.campaign_type,
        message_body: form.message_body.trim(),
        audience: form.audience,
        template_id: form.template_id || undefined,
        customer_ids: form.audience === "selected" ? selectedIds : undefined,
      };

      if (!payload.title || !payload.message_body) {
        throw new Error("Title and message are required");
      }

      if (payload.audience === "selected" && !selectedIds.length) {
        throw new Error("Select at least one customer");
      }

      const count = preview?.recipient_count || 0;
      const confirmed = window.confirm(
        `Queue this ${payload.campaign_type} message for ${count} customer(s)?\n\nMessages are saved in the campaign log (WhatsApp delivery provider can be connected later).`
      );
      if (!confirmed) return;

      const res = await sendWhatsAppCampaign(payload);
      if (!res.success) throw new Error(res.message || "Failed to queue campaign");

      setSuccess(res.message || `Queued for ${res.data?.queued_count || count} customers`);
      setForm(EMPTY_FORM);
      setSelectedIds([]);
      await loadPanel();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send campaign");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p>Loading WhatsApp offers…</p>;
  }

  return (
    <div className="crm-whatsapp">
      <section className="crm-whatsapp-compose">
        <div className="crm-whatsapp-compose__header">
          <div>
            <h2>WhatsApp offers & sales</h2>
            <p>
              Compose offer or sale messages and queue them for all customers (or selected ones).
              Campaigns are stored in the database.
            </p>
          </div>
          <div className="crm-whatsapp-stat">
            <span>Audience ready</span>
            <strong>{preview?.recipient_count ?? 0}</strong>
          </div>
        </div>

        <form className="crm-whatsapp-form" onSubmit={handleSend}>
          <div className="crm-form-grid">
            <label className="crm-field">
              Campaign title *
              <input
                required
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. Weekend Glow Offer"
              />
            </label>

            <label className="crm-field">
              Message type
              <select
                value={form.campaign_type}
                onChange={(e) => updateField("campaign_type", e.target.value)}
              >
                {CAMPAIGN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="crm-field crm-field--full">
              Use template (optional)
              <select value={form.template_id} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Write custom message</option>
                {templates.map((template) => (
                  <option key={template.id || template._id} value={template.id || template._id}>
                    {template.name} ({template.trigger_type})
                  </option>
                ))}
              </select>
            </label>

            <label className="crm-field crm-field--full">
              Message body *
              <textarea
                required
                rows={5}
                value={form.message_body}
                onChange={(e) => updateField("message_body", e.target.value)}
                placeholder="Hi {{name}}, enjoy 20% off facials this weekend at S21 Salon. Book now!"
              />
              <small>Use {"{{name}}"} to personalize with the customer name.</small>
            </label>

            <label className="crm-field crm-field--full">
              Audience
              <div className="crm-audience-options">
                <label className="crm-radio">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "all"}
                    onChange={() => updateField("audience", "all")}
                  />
                  All customers with phone numbers
                </label>
                <label className="crm-radio">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "selected"}
                    onChange={() => updateField("audience", "selected")}
                  />
                  Selected customers only
                </label>
              </div>
            </label>
          </div>

          {form.audience === "selected" && (
            <div className="crm-audience-picker">
              <div className="crm-audience-picker__toolbar">
                <strong>Select customers ({selectedIds.length})</strong>
                <button type="button" className="crm-btn crm-btn--secondary crm-btn--small" onClick={selectAllVisible}>
                  Select all loaded
                </button>
              </div>
              <div className="crm-audience-list">
                {selectableCustomers.length === 0 ? (
                  <p className="page-note">No customers with phone numbers in the current list.</p>
                ) : (
                  selectableCustomers.map((customer) => {
                    const id = String(customer.id || customer._id);
                    return (
                      <label key={id} className="crm-audience-item">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={() => toggleCustomer(id)}
                        />
                        <span>
                          <strong>{customer.name}</strong>
                          <small>{customer.phone}</small>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {error ? <p className="crm-form-error">{error}</p> : null}
          {success ? <p className="crm-form-success">{success}</p> : null}

          <div className="crm-whatsapp-actions">
            <button type="submit" className="crm-btn crm-btn--primary" disabled={busy}>
              {busy ? "Queuing…" : `Queue WhatsApp message (${preview?.recipient_count ?? 0})`}
            </button>
          </div>
        </form>
      </section>

      <section className="crm-table-card">
        <div className="crm-table-toolbar">
          <strong>Recent campaigns</strong>
          <span>Stored in database for audit / later delivery wiring</span>
        </div>

        {campaigns.length === 0 ? (
          <p className="page-note">No WhatsApp campaigns sent yet.</p>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Audience</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th>Queued at</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id || campaign._id}>
                    <td>
                      <div className="crm-name-cell">
                        <strong>{campaign.title}</strong>
                        <span className="crm-notes-cell">{campaign.message_body}</span>
                      </div>
                    </td>
                    <td>{campaign.campaign_type}</td>
                    <td>{campaign.audience}</td>
                    <td>{campaign.recipient_count}</td>
                    <td>
                      <span className="crm-tag">{campaign.status}</span>
                    </td>
                    <td>{formatDateTime(campaign.created_at)}</td>
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
