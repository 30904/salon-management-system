import apiClient from "../client.js";

export async function listBookings(params = {}) {
  const { data } = await apiClient.get("/bookings", { params });
  return data;
}

export async function getBooking(bookingId) {
  const { data } = await apiClient.get(`/bookings/${bookingId}`);
  return data;
}

export async function createBooking(payload) {
  const { data } = await apiClient.post("/bookings", payload);
  return data;
}

export async function updateBooking(bookingId, payload) {
  const { data } = await apiClient.patch(`/bookings/${bookingId}`, payload);
  return data;
}

export async function updateBookingStatus(bookingId, status) {
  const { data } = await apiClient.patch(`/bookings/${bookingId}/status`, {
    status,
  });
  return data;
}

export async function getBookingAvailability(params = {}) {
  const { data } = await apiClient.get("/bookings/availability", { params });
  return data;
}
