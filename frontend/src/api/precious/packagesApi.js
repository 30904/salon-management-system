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

export async function getCustomerPackage(customerPackageId) {
  const response = await apiClient.get(`/customer-packages/${customerPackageId}`);
  return response.data;
}

export async function addWalletFamilyMember(customerPackageId, customerId) {
  const response = await apiClient.post(
    `/customer-packages/${customerPackageId}/family-members`,
    { customer_id: customerId }
  );
  return response.data;
}

export async function removeWalletFamilyMember(customerPackageId, customerId) {
  const response = await apiClient.delete(
    `/customer-packages/${customerPackageId}/family-members/${customerId}`
  );
  return response.data;
}
