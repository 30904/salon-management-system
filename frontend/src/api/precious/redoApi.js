import apiClient from "../client.js";

/**
 * Feature 4 — Service redo / rework API wrappers (precious-owned /redo).
 */

export async function getRedoConfig() {
  const response = await apiClient.get("/redo/config");
  return response.data;
}

export async function createRedoRequest(payload) {
  const response = await apiClient.post("/redo", payload);
  return response.data;
}

export async function listRedoRequests(params = {}) {
  const response = await apiClient.get("/redo", { params });
  return response.data;
}

export async function getRedoRequest(id) {
  const response = await apiClient.get(`/redo/${id}`);
  return response.data;
}

export async function approveRedoRequest(id) {
  const response = await apiClient.post(`/redo/${id}/approve`);
  return response.data;
}

export async function rejectRedoRequest(id) {
  const response = await apiClient.post(`/redo/${id}/reject`);
  return response.data;
}

export async function completeRedoRequest(id, payload = {}) {
  const response = await apiClient.post(`/redo/${id}/complete`, payload);
  return response.data;
}
