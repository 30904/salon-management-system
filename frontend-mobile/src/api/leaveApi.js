import apiClient from "./client.js";

export async function requestLeave(payload) {
  const { data } = await apiClient.post("/leave/request", payload);
  return data;
}

export async function listLeave(params = {}) {
  const { data } = await apiClient.get("/leave", { params });
  return data;
}
