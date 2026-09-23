import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import {
  continueWhatsAppCampaign,
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
  const [offerImage, setOfferImage] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [audienceSearch, setAudienceSearch] = useState("");
  const [audienceResults, setAudienceResults] = useState([]);
  const [audienceSearchBusy, setAudienceSearchBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [continuingId, setContinuingId] = useState(null);
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

  async function handleSend(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const title = form.title.trim();
      const messageBody = form.message_body.trim();

      if (!title || !messageBody) {
        throw new Error("Title and offer details are required");
      }

      if (!offerImage) {
        throw new Error("Please choose an offer image");
      }

      if (form.audience === "selected" && !selectedIds.length) {
        throw new Error("Select at least one customer");
      }

      const recipientCount = preview?.recipient_count ?? 0;
      if (!recipientCount) {
        throw new Error("No customers with valid phone numbers for this audience");
      }

      const dailyLimit = preview?.daily_limit ?? 250;
      const remainingToday = preview?.remaining_today ?? dailyLimit;
      const willSendNow = Math.min(recipientCount, remainingToday);

      const confirmed = window.confirm(
        `Send WhatsApp offer to ${recipientCount} customer(s)?\n\n` +
          `Meta daily limit: ${dailyLimit}\n` +
          `Remaining today: ${remainingToday}\n` +
          `Will start sending now: ${willSendNow}` +
          (recipientCount > remainingToday
            ? `\n\nThe rest stay queued — use Continue tomorrow (or when limit resets).`
            : "") +
          `\n\nApprox. cost ~₹1 per delivered message.`
      );
      if (!confirmed) return;

      const sendRes = await sendWhatsAppCampaign({
        title,
        campaign_type: form.campaign_type,
        message_body: messageBody,
        audience: form.audience,
        template_id: form.template_id || undefined,
        customer_ids: form.audience === "selected" ? selectedIds : undefined,
        image: offerImage,
        notes: "Cloud API one-click offer send",
      });

      const data = sendRes?.data || {};
      setSuccess(
        sendRes?.message ||
          `Offer campaign started for ${data.recipient_count || recipientCount} customer(s).`
      );
      setForm(EMPTY_FORM);
      setOfferImage(null);
      setSelectedCustomers([]);
      await loadPanel();

      // Refresh again shortly so sent counts update while background worker runs
      window.setTimeout(() => {
        loadPanel().catch(() => {});
      }, 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send WhatsApp offer");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue(campaignId) {
    setContinuingId(campaignId);
    setError(null);
    setSuccess(null);
    try {
      const res = await continueWhatsAppCampaign(campaignId);
      setSuccess(res?.message || "Continued campaign send");
      await loadPanel();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to continue campaign");
    } finally {
      setContinuingId(null);
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
              Add an offer image and message, then send to customers in one click via WhatsApp Cloud
              API. Meta daily limit applies (~{preview?.daily_limit ?? 250}/day until business
              verification).
            </p>
          </div>
          <div className="crm-whatsapp-stat">
            <span>Audience ready</span>
            <strong>{preview?.recipient_count ?? 0}</strong>
            <small style={{ display: "block", marginTop: "0.35rem", opacity: 0.85 }}>
              Today {preview?.sent_today ?? 0}/{preview?.daily_limit ?? 250} · left{" "}
              {preview?.remaining_today ?? "—"}
            </small>
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
              Offer image *
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setOfferImage(e.target.files?.[0] || null)}
              />
              <small>
                JPG/PNG/WebP up to 5MB. Uploaded to WhatsApp for this campaign only (not stored on
                S3).
                {offerImage ? ` Selected: ${offerImage.name}` : ""}
              </small>
            </label>

            <label className="crm-field crm-field--full">
              Use CRM template copy (optional)
              <select value={form.template_id} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Write offer text</option>
                {templates.map((template) => (
                  <option key={template.id || template._id} value={template.id || template._id}>
                    {template.name} ({template.trigger_type})
                  </option>
                ))}
              </select>
            </label>

            <label className="crm-field crm-field--full">
              Offer details * (template variable)
              <textarea
                required
                rows={5}
                value={form.message_body}
                onChange={(e) => updateField("message_body", e.target.value)}
                placeholder="Enjoy 20% off facials this weekend — book now at S21 Family Salon!"
              />
              <small>
                Customer name is filled automatically. This text is sent as the offer line in the
                approved Meta template <code>_salon_offer_image</code>.
              </small>
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
                ? "Sending…"
                : `Send offer (${preview?.recipient_count ?? 0})`}
            </button>
          </div>
        </form>
      </section>

      <section className="crm-table-card">
        <div className="crm-table-toolbar">
          <strong>Recent campaigns</strong>
          <span>Cloud API delivery · refresh to see sent counts</span>
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
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Queued at</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const id = campaign.id || campaign._id;
                  const queued = Number(campaign.queued_count ?? 0);
                  const canContinue =
                    queued > 0 &&
                    (campaign.delivery_mode === "cloud_api" || !campaign.delivery_mode);

                  return (
                    <tr key={id}>
                      <td>
                        <div className="crm-name-cell">
                          <strong>{campaign.title}</strong>
                          <span className="crm-notes-cell">{campaign.message_body}</span>
                        </div>
                      </td>
                      <td>{campaign.campaign_type}</td>
                      <td>{campaign.audience}</td>
                      <td>
                        sent {campaign.sent_count ?? 0} · failed {campaign.failed_count ?? 0} ·
                        queued {queued}
                      </td>
                      <td>
                        <span className="crm-tag">{campaign.status}</span>
                      </td>
                      <td>{formatDateTime(campaign.created_at)}</td>
                      <td>
                        {canContinue ? (
                          <button
                            type="button"
                            className="crm-btn crm-btn--secondary crm-btn--small"
                            disabled={Boolean(continuingId)}
                            onClick={() => handleContinue(id)}
                          >
                            {String(continuingId) === String(id) ? "Sending…" : "Continue"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
