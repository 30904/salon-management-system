import apiClient from "../client.js";

export async function listServiceCategories(params = {}) {
  const { data } = await apiClient.get("/service-categories", { params });
  return data;
}

export async function getServiceCategory(categoryId) {
  const { data } = await apiClient.get(`/service-categories/${categoryId}`);
  return data;
}

export async function createServiceCategory(payload) {
  const { data } = await apiClient.post("/service-categories", payload);
  return data;
}

export async function updateServiceCategory(categoryId, payload) {
  const { data } = await apiClient.patch(
    `/service-categories/${categoryId}`,
    payload
  );
  return data;
}

export async function deactivateServiceCategory(categoryId) {
  const { data } = await apiClient.delete(`/service-categories/${categoryId}`);
  return data;
}

export async function listServices(params = {}) {
  const { data } = await apiClient.get("/services", { params });
  return data;
}

export async function getService(serviceId) {
  const { data } = await apiClient.get(`/services/${serviceId}`);
  return data;
}

export async function createService(payload) {
  const { data } = await apiClient.post("/services", payload);
  return data;
}

export async function updateService(serviceId, payload) {
  const { data } = await apiClient.patch(`/services/${serviceId}`, payload);
  return data;
}

export async function deactivateService(serviceId) {
  const { data } = await apiClient.delete(`/services/${serviceId}`);
  return data;
}
