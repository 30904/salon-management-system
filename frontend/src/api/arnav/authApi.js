import apiClient, { setSession } from "../client.js";

export async function login({ phone, email, password }) {
  const { data } = await apiClient.post("/auth/login", { phone, email, password });
  return data;
}

export async function refresh(refreshToken) {
  const { data } = await apiClient.post("/auth/refresh", { refreshToken });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

export async function getPermissions() {
  const { data } = await apiClient.get("/auth/permissions");
  return data;
}

export function saveAuthSession(payload) {
  setSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    permissions: payload.permissions,
  });
}

export function readStoredPermissions() {
  const raw = localStorage.getItem("permissions");

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("permissions");
    return [];
  }
}
