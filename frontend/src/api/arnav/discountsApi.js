import apiClient from "../client.js";

export async function listDiscounts(params = {}) {
  const { data } = await apiClient.get("/discount-masters", { params });
  return data;
}

export async function getDiscount(discountId) {
  const { data } = await apiClient.get(`/discount-masters/${discountId}`);
  return data;
}

export async function createDiscount(payload) {
  const { data } = await apiClient.post("/discount-masters", payload);
  return data;
}

export async function updateDiscount(discountId, payload) {
  const { data } = await apiClient.patch(`/discount-masters/${discountId}`, payload);
  return data;
}

export async function deactivateDiscount(discountId) {
  const { data } = await apiClient.delete(`/discount-masters/${discountId}`);
  return data;
}
