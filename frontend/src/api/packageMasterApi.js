import apiClient from "./client.js";

// Package Master API calls
export async function fetchPackageMasters(params = {}) {
  const response = await apiClient.get("/package-masters", { params });
  return response.data;
}

export async function getPackageMaster(id) {
  const response = await apiClient.get(`/package-masters/${id}`);
  return response.data;
}

export async function createPackageMaster(data) {
  const response = await apiClient.post("/package-masters", data);
  return response.data;
}

export async function updatePackageMaster(id, data) {
  const response = await apiClient.put(`/package-masters/${id}`, data);
  return response.data;
}

export async function deletePackageMaster(id) {
  const response = await apiClient.delete(`/package-masters/${id}`);
  return response.data;
}
