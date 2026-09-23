import { apiClient } from "./client.js";

// WhatsApp Templates CRUD API
export async function fetchWhatsAppTemplates(params = {}) {
  const response = await apiClient.get("/whatsapp-templates", { params });
  return response.data;
}

export async function getWhatsAppTemplate(id) {
  const response = await apiClient.get(`/whatsapp-templates/${id}`);
  return response.data;
}

export async function createWhatsAppTemplate(data) {
  const response = await apiClient.post("/whatsapp-templates", data);
  return response.data;
}

export async function updateWhatsAppTemplate(id, data) {
  const response = await apiClient.put(`/whatsapp-templates/${id}`, data);
  return response.data;
}

export async function deleteWhatsAppTemplate(id) {
  const response = await apiClient.delete(`/whatsapp-templates/${id}`);
  return response.data;
}

export async function previewWhatsAppCampaign(params = {}) {
  const response = await apiClient.get("/whatsapp/campaigns/preview", { params });
  return response.data;
}

export async function listWhatsAppCampaigns(params = {}) {
  const response = await apiClient.get("/whatsapp/campaigns", { params });
  return response.data;
}

/**
 * One-click Cloud API send. `payload.image` must be a File/Blob.
 */
export async function sendWhatsAppCampaign(payload = {}) {
  const formData = new FormData();
  formData.append("title", payload.title || "");
  formData.append("campaign_type", payload.campaign_type || "offer");
  formData.append("message_body", payload.message_body || "");
  formData.append("audience", payload.audience || "all");
  if (payload.template_id) formData.append("template_id", payload.template_id);
  if (payload.notes) formData.append("notes", payload.notes);
  if (Array.isArray(payload.customer_ids) && payload.customer_ids.length) {
    formData.append("customer_ids", JSON.stringify(payload.customer_ids));
  }
  if (payload.image) {
    formData.append("image", payload.image);
  }

  const response = await apiClient.post("/whatsapp/campaigns/send", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function continueWhatsAppCampaign(campaignId) {
  const response = await apiClient.post(`/whatsapp/campaigns/${campaignId}/continue`);
  return response.data;
}
