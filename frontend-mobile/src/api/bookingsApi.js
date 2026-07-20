import apiClient from "./client.js";

export async function listBookings(params = {}) {
  const { data } = await apiClient.get("/bookings", { params });
  return data;
}
