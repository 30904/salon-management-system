import apiClient from "./client.js";

// Shifts API
export async function fetchShifts(params = {}) {
  const response = await apiClient.get("/shifts", { params });
  return response.data;
}

export async function getShift(id) {
  const response = await apiClient.get(`/shifts/${id}`);
  return response.data;
}

export async function createShift(data) {
  const response = await apiClient.post("/shifts", data);
  return response.data;
}

export async function updateShift(id, data) {
  const response = await apiClient.put(`/shifts/${id}`, data);
  return response.data;
}

export async function deleteShift(id) {
  const response = await apiClient.delete(`/shifts/${id}`);
  return response.data;
}

// Attendance Rules API
export async function fetchAttendanceRules(params = {}) {
  const response = await apiClient.get("/attendance-rules", { params });
  return response.data;
}

export async function getActiveAttendanceRule(params = {}) {
  const response = await apiClient.get("/attendance-rules/active", { params });
  return response.data;
}

export async function createAttendanceRule(data) {
  const response = await apiClient.post("/attendance-rules", data);
  return response.data;
}

export async function updateAttendanceRule(id, data) {
  const response = await apiClient.put(`/attendance-rules/${id}`, data);
  return response.data;
}

export async function deleteAttendanceRule(id) {
  const response = await apiClient.delete(`/attendance-rules/${id}`);
  return response.data;
}

// Evaluate Deduction Helper
export async function evaluateDeduction(data) {
  const response = await apiClient.post("/attendance-rules/evaluate-deduction", data);
  return response.data;
}
