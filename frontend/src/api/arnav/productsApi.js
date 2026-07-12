import apiClient from "../client.js";

export async function listProducts(params = {}) {
  const { data } = await apiClient.get("/products", { params });
  return data;
}

export async function listLowStockProducts() {
  const { data } = await apiClient.get("/products/low-stock");
  return data;
}

export async function getProduct(productId) {
  const { data } = await apiClient.get(`/products/${productId}`);
  return data;
}

export async function createProduct(payload) {
  const { data } = await apiClient.post("/products", payload);
  return data;
}

export async function updateProduct(productId, payload) {
  const { data } = await apiClient.patch(`/products/${productId}`, payload);
  return data;
}

export async function deactivateProduct(productId) {
  const { data } = await apiClient.delete(`/products/${productId}`);
  return data;
}
