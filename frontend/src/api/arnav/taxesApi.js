import apiClient from "../client.js";

export async function listTaxes(params = {}) {
  const { data } = await apiClient.get("/taxes", { params });
  return data;
}

export async function getTax(taxId) {
  const { data } = await apiClient.get(`/taxes/${taxId}`);
  return data;
}

export async function createTax(payload) {
  const { data } = await apiClient.post("/taxes", payload);
  return data;
}

export async function updateTax(taxId, payload) {
  const { data } = await apiClient.patch(`/taxes/${taxId}`, payload);
  return data;
}

export async function deactivateTax(taxId) {
  const { data } = await apiClient.delete(`/taxes/${taxId}`);
  return data;
}
