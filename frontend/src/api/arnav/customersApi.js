import apiClient from "../client.js";

export async function searchCustomers(params = {}) {
  const { data } = await apiClient.get("/customers/search", { params });
  return data;
}

/**
 * GET /customers — paginated CRM list (Feature 2 lazy load).
 * Query: search, page (default 1), pageSize (default 25, max 50).
 * Response data: { items, total, page, pageSize, hasMore } — not a bare array.
 */
export async function listCustomers(params = {}) {
  const query = { ...params };
  if (query.pageSize == null && query.limit != null) {
    query.pageSize = query.limit;
    delete query.limit;
  }
  const { data } = await apiClient.get("/customers", { params: query });
  return data;
}

export async function findOrCreateCustomer(payload) {
  const { data } = await apiClient.post("/customers/find-or-create", payload);
  return data;
}

export async function getCustomer(customerId) {
  const { data } = await apiClient.get(`/customers/${customerId}`);
  return data;
}

export async function createCustomer(payload) {
  const { data } = await apiClient.post("/customers", payload);
  return data;
}

export async function updateCustomer(customerId, payload) {
  const { data } = await apiClient.patch(`/customers/${customerId}`, payload);
  return data;
}

export async function deleteCustomer(customerId) {
  const { data } = await apiClient.delete(`/customers/${customerId}`);
  return data;
}

/** POST /customers/import — FormData with field name `file` (csv/xlsx). */
export async function importCustomers(formData) {
  const { data } = await apiClient.post("/customers/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** GET /customers/import/:batchId */
export async function getImportBatch(batchId) {
  const { data } = await apiClient.get(`/customers/import/${batchId}`);
  return data;
}

/** GET /customers/inactive?threshold_days=&search=&page=&pageSize= */
export async function getInactiveCustomers({
  thresholdDays,
  search,
  page,
  pageSize,
} = {}) {
  const params = {};
  if (thresholdDays !== undefined && thresholdDays !== null && thresholdDays !== "") {
    params.threshold_days = thresholdDays;
  }
  if (search) params.search = search;
  if (page != null) params.page = page;
  if (pageSize != null) params.pageSize = pageSize;
  const { data } = await apiClient.get("/customers/inactive", { params });
  return data;
}
