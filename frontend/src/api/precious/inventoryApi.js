import apiClient from "../client.js";

export async function getAdjustmentReasons() {
  const { data } = await apiClient.get("/inventory/meta/reasons");
  return data;
}

export async function listInventory(params = {}) {
  const { data } = await apiClient.get("/inventory", { params });
  return data;
}

export async function getStockReport() {
  const { data } = await apiClient.get("/inventory/stock-report");
  return data;
}

export async function getInventoryProduct(productId) {
  const { data } = await apiClient.get(`/inventory/${productId}`);
  return data;
}

export async function deductStock(productId, payload) {
  const { data } = await apiClient.post(`/inventory/${productId}/deduct`, payload);
  return data;
}

export async function topUpStock(productId, payload) {
  const { data } = await apiClient.post(`/inventory/${productId}/top-up`, payload);
  return data;
}

export async function getProductAuditLog(productId, params = {}) {
  const { data } = await apiClient.get(`/inventory/${productId}/audit-log`, { params });
  return data;
}

export async function getAllAuditLogs(params = {}) {
  const { data } = await apiClient.get("/inventory/audit-logs", { params });
  return data;
}
