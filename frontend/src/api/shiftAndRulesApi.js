import apiClient from "./client.js";

// Shifts API
export async function fetchShifts(params = {}) {
  const response = await apiClient.get("/shifts", { params });
  return response.data;
}

export async function getShift(id) {
  const response = await apiClient.get(`/shifts/${id}`);
  return response.data;
}

export async function createShift(data) {
  const response = await apiClient.post("/shifts", data);
  return response.data;
}

export async function updateShift(id, data) {
  const response = await apiClient.put(`/shifts/${id}`, data);
  return response.data;
}

export async function deleteShift(id) {
  const response = await apiClient.delete(`/shifts/${id}`);
  return response.data;
}
