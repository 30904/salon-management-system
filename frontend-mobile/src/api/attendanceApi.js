import apiClient from "./client.js";

export async function getAttendanceToday(params = {}) {
  const { data } = await apiClient.get("/attendance/today", { params });
  return data;
}

export async function getAttendanceStatus(params = {}) {
  const { data } = await apiClient.get("/attendance/status", { params });
  return data;
}

export async function getAttendanceSummary(params = {}) {
  const { data } = await apiClient.get("/attendance/summary", { params });
  return data;
}

export async function punchIn(payload) {
  const { data } = await apiClient.post("/attendance/punch-in", payload);
  return data;
}

export async function punchOut(payload) {
  const { data } = await apiClient.post("/attendance/punch-out", payload);
  return data;
}
