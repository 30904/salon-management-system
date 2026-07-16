import apiClient from "../client.js";

export async function getAttendanceToday(params = {}) {
  const response = await apiClient.get("/attendance/today", { params });
  return response.data;
}

export async function getAttendanceStatus(params = {}) {
  const response = await apiClient.get("/attendance/status", { params });
  return response.data;
}

export async function getAttendanceSummary(params = {}) {
  const response = await apiClient.get("/attendance/summary", { params });
  return response.data;
}

export async function getAttendanceRecords(params = {}) {
  const response = await apiClient.get("/attendance", { params });
  return response.data;
}

export async function punchIn(data) {
  const response = await apiClient.post("/attendance/punch-in", data);
  return response.data;
}

export async function punchOut(data) {
  const response = await apiClient.post("/attendance/punch-out", data);
  return response.data;
}

