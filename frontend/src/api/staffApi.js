import apiClient from "./client.js";

export async function fetchStaffProfiles(params = {}) {
  const response = await apiClient.get("/staff", { params });
  return response.data;
}

export async function getStaffProfile(id) {
  const response = await apiClient.get(`/staff/${id}`);
  return response.data;
}

export async function createStaffProfile(data) {
  const response = await apiClient.post("/staff", data);
  return response.data;
}

export async function updateStaffProfile(id, data) {
  const response = await apiClient.put(`/staff/${id}`, data);
  return response.data;
}

export async function deleteStaffProfile(id) {
  const response = await apiClient.delete(`/staff/${id}`);
  return response.data;
}

export async function fetchCommissionSlabs(params = {}) {
  const response = await apiClient.get("/commission-slabs", { params });
  return response.data;
}

export async function fetchUsersForStaff(params = {}) {
  // If there is an endpoint for listing users or candidates
  try {
    const response = await apiClient.get("/users", { params });
    return response.data;
  } catch (error) {
    // If /users is not mounted or restricted, return empty array
    return { success: true, data: [] };
  }
}
