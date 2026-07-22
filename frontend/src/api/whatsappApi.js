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

export async function sendWhatsAppCampaign(payload) {
  const response = await apiClient.post("/whatsapp/campaigns/send", payload);
  return response.data;
}
