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

export function saveAuthSession(payload) {
  setSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });
}
