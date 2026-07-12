import apiClient from "../client.js";

export async function getMyEarnings(params = {}) {
  const { data } = await apiClient.get("/staff/me/earnings", { params });
  return data;
}
