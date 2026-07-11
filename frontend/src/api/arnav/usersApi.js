import apiClient from "../client.js";

export async function listUsers(params = {}) {
  const { data } = await apiClient.get("/users", { params });
  return data;
}

export async function getUser(userId) {
  const { data } = await apiClient.get(`/users/${userId}`);
  return data;
}

export async function createUser(payload) {
  const { data } = await apiClient.post("/users", payload);
  return data;
}

export async function updateUser(userId, payload) {
  const { data } = await apiClient.patch(`/users/${userId}`, payload);
  return data;
}

export async function deactivateUser(userId) {
  const { data } = await apiClient.patch(`/users/${userId}/deactivate`);
  return data;
}

export async function activateUser(userId) {
  const { data } = await apiClient.patch(`/users/${userId}/activate`);
  return data;
}

export async function getUserPermissionOverrides(userId) {
  const { data } = await apiClient.get(`/users/${userId}/permission-overrides`);
  return data;
}

export async function updateUserPermissionOverrides(userId, overrides) {
  const { data } = await apiClient.put(`/users/${userId}/permission-overrides`, {
    overrides,
  });
  return data;
}

export async function resendUserInvite(userId) {
  const { data } = await apiClient.post(`/users/${userId}/resend-invite`);
  return data;
}
