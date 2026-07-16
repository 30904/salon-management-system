import apiClient from "../client.js";

export async function getOwnerReports(params = {}) {
  const { data } = await apiClient.get("/reports/owner", { params });
  return data;
}
