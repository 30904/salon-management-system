import apiClient from "../client.js";

/**
 * Precious-owned Billing & POS API calls
 */

export async function createInvoice(payload) {
  const response = await apiClient.post("/invoices", payload);
  return response.data;
}

export async function listInvoices(params = {}) {
  const response = await apiClient.get("/invoices", { params });
  return response.data;
}

export async function getInvoice(id) {
  const response = await apiClient.get(`/invoices/${id}`);
  return response.data;
}

export async function voidInvoice(id, payload = {}) {
  const response = await apiClient.post(`/invoices/${id}/void`, payload);
  return response.data;
}

export async function fetchCustomerActivePackages(customerId) {
  if (!customerId) return { success: true, data: [] };
  try {
    const response = await apiClient.get(`/customer-packages/customer/${customerId}/active`);
    return response.data;
  } catch (err) {
    console.error("Failed to fetch customer active packages:", err);
    return { success: true, data: [] };
  }
}
