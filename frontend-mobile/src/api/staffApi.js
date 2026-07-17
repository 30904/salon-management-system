import apiClient from "./client.js";

export async function fetchStaffProfiles(params = {}) {
  const { data } = await apiClient.get("/staff", { params });
  return data;
}

export async function getMyEarnings(params = {}) {
  const { data } = await apiClient.get("/staff/me/earnings", { params });
  return data;
}

export async function getMyCalendar(params = {}) {
  const { data } = await apiClient.get("/staff/me/calendar", { params });
  return data;
}
