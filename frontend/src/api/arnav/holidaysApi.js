import apiClient from "../client.js";

export async function listHolidays(params = {}) {
  const { data } = await apiClient.get("/holidays", { params });
  return data;
}

export async function createHoliday(payload) {
  const { data } = await apiClient.post("/holidays", payload);
  return data;
}
