import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import {
  fetchWhatsAppTemplates,
  listWhatsAppCampaigns,
  previewWhatsAppCampaign,
  sendWhatsAppCampaign,
} from "../../api/whatsappApi.js";
import {
  buildRecipientSendList,
  openCampaignWhatsApp,
} from "../../utils/whatsappCampaign.js";

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

const AUDIENCE_SEARCH_DEBOUNCE_MS = 300;

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

export default function CrmWhatsAppOffers() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [audienceSearch, setAudienceSearch] = useState("");
  const [audienceResults, setAudienceResults] = useState([]);
  const [audienceSearchBusy, setAudienceSearchBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [sendQueue, setSendQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const selectedIds = useMemo(
    () => selectedCustomers.map((customer) => String(customer.id || customer._id)),
    [selectedCustomers]
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

  useEffect(() => {
    const term = audienceSearch.trim();
    if (term.length < 2) {
      setAudienceResults([]);
      setAudienceSearchBusy(false);
      return undefined;
    }

    setAudienceSearchBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await arnavApi.searchCustomers({ q: term, limit: 20 });
        const rows = Array.isArray(res?.data) ? res.data : [];
        setAudienceResults(rows.filter((row) => row.phone));
      } catch {
        setAudienceResults([]);
      } finally {
        setAudienceSearchBusy(false);
      }
    }, AUDIENCE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [audienceSearch]);

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

  function addSelectedCustomer(customer) {
    const id = String(customer.id || customer._id);
    setSelectedCustomers((prev) => {
      if (prev.some((row) => String(row.id || row._id) === id)) return prev;
      return [
        ...prev,
        {
          id,
          name: customer.name || "Customer",
          phone: customer.phone,
        },
      ];
    });
    setAudienceSearch("");
    setAudienceResults([]);
  }

  function removeSelectedCustomer(customerId) {
    const id = String(customerId);
    setSelectedCustomers((prev) =>
      prev.filter((row) => String(row.id || row._id) !== id)
    );
  }

  function markQueueOpened(customerId) {
    setSendQueue((prev) =>
      prev.map((row) => (row.id === customerId ? { ...row, opened: true } : row))
    );
  }

  function handleOpenRecipient(recipient) {
    const opened = openCampaignWhatsApp({
      phone: recipient.phone,
      message: recipient.message,
    });
    if (opened) markQueueOpened(recipient.id);
  }

  async function handleSend(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const title = form.title.trim();
      const messageBody = form.message_body.trim();

      if (!title || !messageBody) {
        throw new Error("Title and message are required");
      }

      if (form.audience === "selected" && !selectedIds.length) {
        throw new Error("Select at least one customer");
      }

      const recipientCount = preview?.recipient_count ?? 0;
      if (!recipientCount) {
        throw new Error("No customers with valid phone numbers for this audience");
      }

      const confirmed = window.confirm(
        `Open WhatsApp for ${recipientCount} customer(s)?\n\nYour message will be prefilled — tap Send in WhatsApp for each chat.`
      );
      if (!confirmed) return;

      const sendRes = await sendWhatsAppCampaign({
        title,
        campaign_type: form.campaign_type,
        message_body: messageBody,
        audience: form.audience,
        template_id: form.template_id || undefined,
        customer_ids: form.audience === "selected" ? selectedIds : undefined,
        notes: "Opened via wa.me for manual Send",
      });

      const campaign = sendRes?.data || {};
      const serverRecipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];
      const sendList = buildRecipientSendList(
        messageBody,
        serverRecipients.map((row) => ({
          id: String(row.customer_id || row.phone),
          name: row.name || "Customer",
          phone: row.phone,
        }))
      );

      if (!sendList.length) {
        throw new Error("No valid WhatsApp phone numbers found for this audience");
      }

      const [first, ...rest] = sendList;
      const openedFirst = openCampaignWhatsApp({
        phone: first.phone,
        message: first.message,
      });

      setSendQueue([
        { ...first, opened: openedFirst },
        ...rest.map((row) => ({ ...row, opened: false })),
      ]);

      setSuccess(
        rest.length
          ? `WhatsApp opened for ${first.name}. Open the remaining ${rest.length} chat(s) below and tap Send in WhatsApp.`
          : `WhatsApp opened for ${first.name}. Tap Send in WhatsApp to deliver.`
      );
      setForm(EMPTY_FORM);
      setSelectedCustomers([]);
      await loadPanel();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to open WhatsApp");
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
              Compose the offer message here, then open WhatsApp with it prefilled. You tap Send in
              WhatsApp for each customer (same as bookings and package updates).
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
              <small>Use {"{{name}}"} to personalize with the customer name. Message opens in WhatsApp — you tap Send.</small>
            </label>

            <div className="crm-field crm-field--full">
              Audience
              <div className="crm-audience-options">
                <label className="crm-radio">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "all"}
                    onChange={() => updateField("audience", "all")}
                  />
                  All customers with phone numbers (server audience)
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
            </div>
          </div>

          {form.audience === "selected" && (
            <div className="crm-audience-picker">
              <div className="crm-audience-picker__toolbar">
                <strong>Selected customers ({selectedCustomers.length})</strong>
              </div>

              {selectedCustomers.length > 0 ? (
                <div className="crm-audience-list">
                  {selectedCustomers.map((customer) => (
                    <div key={customer.id} className="crm-audience-item">
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.phone}</small>
                      </span>
                      <button
                        type="button"
                        className="crm-btn crm-btn--secondary crm-btn--small"
                        onClick={() => removeSelectedCustomer(customer.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="page-note">Search and add customers below (min 2 characters).</p>
              )}

              <label className="crm-field crm-field--full" style={{ marginTop: "0.85rem" }}>
                Search customers to add
                <input
                  type="text"
                  value={audienceSearch}
                  onChange={(e) => setAudienceSearch(e.target.value)}
                  placeholder="Type name or phone…"
                />
              </label>

              {audienceSearchBusy ? <p className="page-note">Searching…</p> : null}

              {audienceResults.length > 0 ? (
                <div className="crm-audience-list">
                  {audienceResults.map((customer) => {
                    const id = String(customer.id || customer._id);
                    const alreadySelected = selectedIds.includes(id);
                    return (
                      <div key={id} className="crm-audience-item">
                        <span>
                          <strong>{customer.name}</strong>
                          <small>{customer.phone}</small>
                        </span>
                        <button
                          type="button"
                          className="crm-btn crm-btn--secondary crm-btn--small"
                          disabled={alreadySelected}
                          onClick={() => addSelectedCustomer(customer)}
                        >
                          {alreadySelected ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="crm-form-error">{error}</p> : null}
          {success ? <p className="crm-form-success">{success}</p> : null}

          <div className="crm-whatsapp-actions">
            <button type="submit" className="crm-btn crm-btn--primary" disabled={busy}>
              {busy
                ? "Opening WhatsApp…"
                : `Open in WhatsApp (${preview?.recipient_count ?? 0})`}
            </button>
          </div>
        </form>
      </section>

      {sendQueue.length > 0 && (
        <section className="crm-table-card crm-whatsapp-queue">
          <div className="crm-table-toolbar">
            <strong>Send queue</strong>
            <span>Open each chat and tap Send in WhatsApp</span>
          </div>
          <div className="crm-whatsapp-queue-list">
            {sendQueue.map((recipient) => (
              <div key={recipient.id} className="crm-whatsapp-queue-item">
                <div>
                  <strong>{recipient.name}</strong>
                  <small>{recipient.phone}</small>
                </div>
                <button
                  type="button"
                  className={`crm-btn ${recipient.opened ? "crm-btn--secondary" : "crm-btn--primary"} crm-btn--small`}
                  onClick={() => handleOpenRecipient(recipient)}
                >
                  {recipient.opened ? "Open again" : "Open WhatsApp"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="crm-table-card">
        <div className="crm-table-toolbar">
          <strong>Recent campaigns</strong>
          <span>Stored in database for audit</span>
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
