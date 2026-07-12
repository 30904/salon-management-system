import apiClient from "../client.js";

export async function getMyCalendar(params = {}) {
  const { data } = await apiClient.get("/staff/me/calendar", { params });
  return data;
}
