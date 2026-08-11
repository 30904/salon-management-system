import apiClient from "../client.js";

export async function requestLeave(data) {
  const response = await apiClient.post("/leave/request", data);
  return response.data;
}

export async function listLeave(params = {}) {
  const response = await apiClient.get("/leave", { params });
  return response.data;
}

export async function approveLeave(id) {
  const response = await apiClient.post(`/leave/${id}/approve`);
  return response.data;
}

export async function rejectLeave(id) {
  const response = await apiClient.post(`/leave/${id}/reject`);
  return response.data;
}

export async function swapLeave(data) {
  const response = await apiClient.post("/leave/swap", data);
  return response.data;
}
