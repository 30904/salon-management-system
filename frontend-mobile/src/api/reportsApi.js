import apiClient from "./client.js";

export async function getOwnerReports(params = {}) {
  const { data } = await apiClient.get("/reports/owner", { params });
  return data;
}

export async function getTeamToday() {
  const { data } = await apiClient.get("/reports/team-today");
  return data;
}
