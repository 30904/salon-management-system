import apiClient from "../client.js";

export async function runPayroll(payload) {
  const { data } = await apiClient.post("/payroll/run", payload);
  return data;
}

export async function getPayrollRun(runId) {
  const { data } = await apiClient.get(`/payroll/run/${runId}`);
  return data;
}

export async function finalizePayrollRun(runId) {
  const { data } = await apiClient.post(`/payroll/run/${runId}/finalize`);
  return data;
}

export async function getStaffPayslip(staffId, params = {}) {
  const { data } = await apiClient.get(`/payroll/staff/${staffId}`, { params });
  return data;
}
