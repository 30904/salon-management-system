import React, { useState } from "react";
import { createWhatsAppTemplate, updateWhatsAppTemplate } from "../../../api/whatsappApi.js";
import "./WhatsAppSettings.css";

const PREAPPROVED_PRESETS = [
  {
    name: "VIP Appointment Confirmation",
    trigger_type: "appointment_confirmation",
    message_body: "Hi {{customer_name}}, your {{service_name}} appointment with {{staff_name}} at S21 Salon & Spa is confirmed for {{date}} at {{time}}. We look forward to pampering you!",
    description: "Automatically sent when front desk or client confirms a booking.",
  },
  {
    name: "2-Hour Appointment Reminder",
    trigger_type: "appointment_reminder",
    message_body: "Reminder: Hi {{customer_name}}, you have an appointment for {{service_name}} today at {{time}} with {{staff_name}}. Please let us know if you need to reschedule.",
    description: "Sent 2 hours prior to scheduled appointment slot.",
  },
  {
    name: "Digital Invoice & Thank You Note",
    trigger_type: "invoice_sent",
    message_body: "Thank you for visiting S21 Salon & Spa, {{customer_name}}! Your total bill amount for invoice #{{invoice_id}} is ₹{{amount}}. We hope to see you again soon!",
    description: "Triggered instantly when POS checkout & payment is completed.",
  },
  {
    name: "Special Birthday VIP Offer",
    trigger_type: "birthday_wish",
    message_body: "Happy Birthday, {{customer_name}}! To celebrate your special day, enjoy an exclusive 20% OFF on any hair or spa service this week at S21 Salon. Show this text at checkout!",
    description: "Automated CRM cron dispatch on client's birthday morning.",
  },
  {
    name: "Package Expiration Warning",
    trigger_type: "package_expiring",
    message_body: "Hi {{customer_name}}, your prepaid package '{{package_name}}' has sessions remaining and is expiring soon. Book your slot today before it lapses!",
    description: "Sent when client package validity has 7 days or less remaining.",
  },
  {
    name: "Festive Glow Special Campaign",
    trigger_type: "custom_campaign",
    message_body: "Festive Glow Special at S21 Salon & Spa! Hey {{customer_name}}, book any Facial or Keratin treatment this weekend and get a complimentary Hair Spa. Limited slots available!",
    description: "Pre-approved promotional broadcast template for holiday campaigns.",
  },
];

const VARIABLE_PILLS = [
  "{{customer_name}}",
  "{{service_name}}",
  "{{staff_name}}",
  "{{date}}",
  "{{time}}",
  "{{amount}}",
  "{{invoice_id}}",
  "{{package_name}}",
];

export default function TemplateForm({ profile = null, onClose, onSuccess }) {
  const isEdit = Boolean(profile);

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    trigger_type: profile?.trigger_type || "appointment_confirmation",
    message_body: profile?.message_body || "",
    is_active: profile?.is_active !== undefined ? profile.is_active : true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLoadPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      trigger_type: preset.trigger_type,
      message_body: preset.message_body,
    }));
  };

  const handleInsertVariable = (variable) => {
    setFormData((prev) => ({
      ...prev,
      message_body: prev.message_body ? `${prev.message_body} ${variable}` : variable,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!formData.name.trim() || !formData.message_body.trim()) {
        throw new Error("Template name and message body are required.");
      }

      const payload = {
        name: formData.name.trim(),
        trigger_type: formData.trigger_type.trim(),
        message_body: formData.message_body.trim(),
        is_active: formData.is_active,
      };

      if (isEdit) {
        await updateWhatsAppTemplate(profile.id || profile._id, payload);
      } else {
        await createWhatsAppTemplate(payload);
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save WhatsApp template.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="whatsapp-form-modal">
        <h2 className="modal-title">{isEdit ? "Edit WhatsApp Template" : "Add New WhatsApp Template"}</h2>
        <p className="modal-sub">
          Configure pre-approved message templates for campaigns and automated system notifications.
        </p>

        {error && <div className="status-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {/* Pre-approved campaign presets helper */}
        <div className="preset-section">
          <div className="preset-title">
            <span>Pre-approved Campaign & Automation Presets (Click to Auto-fill)</span>
          </div>
          <div className="preset-grid">
            {PREAPPROVED_PRESETS.map((preset, idx) => (
              <div key={idx} className="preset-card" onClick={() => handleLoadPreset(preset)}>
                <div className="preset-card-name">{preset.name}</div>
                <div className="preset-card-desc">{preset.description}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid-2col">
          {/* 1. Template Name */}
          <div className="form-group full-width">
            <label htmlFor="name">Template Title / Campaign Name *</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-control"
              placeholder="e.g. VIP Appointment Confirmation"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* 2. Trigger Type */}
          <div className="form-group full-width">
            <label htmlFor="trigger_type">Automation Event / Trigger *</label>
            <select
              id="trigger_type"
              name="trigger_type"
              className="form-control"
              value={formData.trigger_type}
              onChange={handleChange}
              required
            >
              <option value="appointment_confirmation">Appointment Confirmation (Booking Made)</option>
              <option value="appointment_reminder">Appointment Reminder (2 Hours Prior)</option>
              <option value="invoice_sent">Digital Invoice / Thank You Receipt (POS Checkout)</option>
              <option value="birthday_wish">Birthday Wish & VIP Offer (CRM Automation)</option>
              <option value="package_expiring">Package Expiration Alert (Package Management)</option>
              <option value="custom_campaign">Custom Marketing Campaign Broadcast</option>
            </select>
          </div>

          {/* 3. Variables Helper */}
          <div className="form-group full-width">
            <label>Insert Dynamic Variables (Click to Append to Message)</label>
            <div className="variables-row">
              {VARIABLE_PILLS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="var-pill-btn"
                  onClick={() => handleInsertVariable(v)}
                  title={`Insert ${v} tag`}
                >
                  + {v}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Message Body */}
          <div className="form-group full-width">
            <label htmlFor="message_body">WhatsApp Message Body *</label>
            <textarea
              id="message_body"
              name="message_body"
              rows={4}
              className="form-control"
              placeholder="Type your message text or choose a preset above..."
              value={formData.message_body}
              onChange={handleChange}
              required
              style={{ fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* 5. Live Smartphone Bubble Preview */}
          <div className="form-group full-width">
            <label>Live WhatsApp Message Preview</label>
            <div className="phone-preview-box">
              <div className="phone-preview-header">
                <span>S21 Salon & Spa (Official Business)</span>
              </div>
              <div className="phone-bubble">
                {formData.message_body ? (
                  formData.message_body
                ) : (
                  <span style={{ color: "#667781", fontStyle: "italic" }}>
                    Your preview will appear here as you type...
                  </span>
                )}
                <div className="phone-bubble-time">
                  <span>11:45 AM</span>
                  <span>✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Active Toggle */}
          <div className="form-group full-width" style={{ alignItems: "flex-start", marginTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                style={{ width: "18px", height: "18px" }}
              />
              Active (Enabled for automatic dispatch & campaign broadcasts)
            </label>
          </div>

          <div className="modal-footer full-width">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update Template" : "Save Pre-approved Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
