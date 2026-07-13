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
