import apiClient from "../client.js";

export async function searchCustomers(params = {}) {
  const { data } = await apiClient.get("/customers/search", { params });
  return data;
}

export async function listCustomers(params = {}) {
  const { data } = await apiClient.get("/customers", { params });
  return data;
}

export async function findOrCreateCustomer(payload) {
  const { data } = await apiClient.post("/customers/find-or-create", payload);
  return data;
}

export async function getCustomer(customerId) {
  const { data } = await apiClient.get(`/customers/${customerId}`);
  return data;
}

export async function createCustomer(payload) {
  const { data } = await apiClient.post("/customers", payload);
  return data;
}

export async function updateCustomer(customerId, payload) {
  const { data } = await apiClient.patch(`/customers/${customerId}`, payload);
  return data;
}

export async function deleteCustomer(customerId) {
  const { data } = await apiClient.delete(`/customers/${customerId}`);
  return data;
}
