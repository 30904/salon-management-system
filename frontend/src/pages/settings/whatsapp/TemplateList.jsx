import React, { useState, useEffect, useCallback } from "react";
import { fetchWhatsAppTemplates, deleteWhatsAppTemplate } from "../../../api/whatsappApi.js";
import TemplateForm from "./TemplateForm.jsx";
import "./WhatsAppSettings.css";

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (triggerFilter) {
        params.trigger_type = triggerFilter;
      }
      if (statusFilter !== "") {
        params.is_active = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await fetchWhatsAppTemplates(params);
      if (res?.success) {
        setTemplates(res.data || []);
      } else {
        setError("Failed loading WhatsApp templates.");
      }
    } catch (err) {
      console.error("Error loading WhatsApp templates:", err);
      setError(err.response?.data?.message || "Unable to connect to WhatsApp Templates API.");
    } finally {
      setLoading(false);
    }
  }, [triggerFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleOpenCreate = () => {
    setSelectedTemplate(null);
    setShowModal(true);
  };

  const handleOpenEdit = (template) => {
    setSelectedTemplate(template);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTemplate(null);
  };

  const handleFormSuccess = () => {
    handleCloseModal();
    loadTemplates();
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      return;
    }
    try {
      await deleteWhatsAppTemplate(template.id || template._id);
      loadTemplates();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to delete WhatsApp template.");
    }
  };

  const getTriggerBadgeClass = (triggerType) => {
    if (!triggerType) return "trigger-pill";
    if (triggerType.includes("appointment")) return "trigger-pill booking";
    if (triggerType.includes("invoice")) return "trigger-pill billing";
    if (triggerType.includes("birthday") || triggerType.includes("package")) return "trigger-pill crm";
    return "trigger-pill campaign";
  };

  const formatTriggerTitle = (triggerType) => {
    switch (triggerType) {
      case "appointment_confirmation":
        return "Appointment Confirmation";
      case "appointment_reminder":
        return "Appointment Reminder";
      case "invoice_sent":
        return "Digital Invoice & Receipt";
      case "birthday_wish":
        return "Birthday Offer / CRM";
      case "package_expiring":
        return "Package Expiry Alert";
      case "custom_campaign":
        return "Promotional Campaign";
      default:
        return triggerType;
    }
  };

  return (
    <div className="whatsapp-master-container">
      {/* Header Banner */}
      <div className="whatsapp-header-banner">
        <div className="whatsapp-banner-text">
          <h1>WhatsApp Templates & Campaigns</h1>
          <p>
            Manage pre-approved message templates for automated notifications, CRM workflows, and promotional campaigns.
            Restricted to Owner/Manager access.
          </p>
        </div>
        <button className="btn-whatsapp-primary" onClick={handleOpenCreate}>
          + Add New Template
        </button>
      </div>

      {/* Filter Bar */}
      <div className="whatsapp-filter-bar">
        <input
          type="text"
          className="whatsapp-filter-input"
          placeholder="Search templates by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="whatsapp-select"
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
        >
          <option value="">All Automation Triggers</option>
          <option value="appointment_confirmation">Appointment Confirmation</option>
          <option value="appointment_reminder">Appointment Reminder</option>
          <option value="invoice_sent">Digital Invoice & Receipt</option>
          <option value="birthday_wish">Birthday Wish & VIP Offer</option>
          <option value="package_expiring">Package Expiration Alert</option>
          <option value="custom_campaign">Promotional Campaign</option>
        </select>

        <select
          className="whatsapp-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {/* Main Content Area */}
      {error && <div className="status-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
          Loading WhatsApp message templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", background: "#f8fafc", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
          <p style={{ fontSize: "1.1rem", color: "#475569", margin: "0 0 1rem" }}>
            No WhatsApp templates found matching your filters.
          </p>
          <button className="btn-whatsapp-primary" onClick={handleOpenCreate}>
            + Add First Pre-approved Template
          </button>
        </div>
      ) : (
        <div className="whatsapp-grid-table-card">
          <table className="whatsapp-table">
            <thead>
              <tr>
                <th>Template Title</th>
                <th>Trigger Event</th>
                <th>Pre-approved Message Body</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id || template._id}>
                  <td>
                    <strong style={{ color: "#0f172a", fontSize: "1rem" }}>{template.name}</strong>
                  </td>
                  <td>
                    <span className={getTriggerBadgeClass(template.trigger_type)}>
                      {formatTriggerTitle(template.trigger_type)}
                    </span>
                  </td>
                  <td>
                    <div className="template-code-preview">{template.message_body}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${template.is_active ? "ok" : "warn"}`}>
                      {template.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="actions-row">
                      <button
                        className="btn-icon-action"
                        onClick={() => handleOpenEdit(template)}
                        title="Edit Template"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-icon-action danger"
                        onClick={() => handleDelete(template)}
                        title="Delete Template"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Form */}
      {showModal && (
        <TemplateForm
          profile={selectedTemplate}
          onClose={handleCloseModal}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
