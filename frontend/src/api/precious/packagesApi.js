import apiClient from "../client.js";

/**
 * Precious-owned Customer Packages & Memberships API calls
 */

export async function sellCustomerPackage(payload) {
  const response = await apiClient.post("/packages/sale", payload);
  return response.data;
}

export async function listCustomerPackages(params = {}) {
  const response = await apiClient.get("/packages", { params });
  return response.data;
}

export async function fetchActivePackageMasters(params = {}) {
  const response = await apiClient.get("/package-masters", { params });
  return response.data;
}
