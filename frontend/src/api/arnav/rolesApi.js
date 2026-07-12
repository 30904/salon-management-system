import apiClient from "../client.js";

export async function listRoles() {
  const { data } = await apiClient.get("/roles");
  return data;
}
