import {
  cancelBooking,
  createBooking,
  getBookingAvailability,
  getBookingById,
  getBookingFeatureFlagsForApi,
  listBookings,
  updateBooking,
  updateBookingStatus,
} from "../services/bookingService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getBookingFeatureFlagsHandler(req, res) {
  const flags = await getBookingFeatureFlagsForApi();

  return sendSuccess(res, {
    data: flags,
    message: "Booking feature flags fetched",
  });
}

export async function getBookingAvailabilityHandler(req, res) {
  const availability = await getBookingAvailability({
    stylistId: req.query.stylist_id,
    date: req.query.date,
    durationMinutes: req.query.duration_minutes,
    excludeBookingId: req.query.exclude_booking_id,
  });

  return sendSuccess(res, {
    data: availability,
    message: "Availability fetched",
  });
}

export async function listBookingsHandler(req, res) {
  const bookings = await listBookings({
    date: req.query.date,
    status: req.query.status,
    stylistId: req.query.stylist_id,
    customerId: req.query.customer_id,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    data: bookings.map((booking) => booking.toSafeObject()),
    message: "Bookings fetched",
  });
}

export async function getBookingHandler(req, res) {
  const booking = await getBookingById(req.params.id);

  return sendSuccess(res, {
    data: booking.toSafeObject(),
    message: "Booking fetched",
  });
}

export async function createBookingHandler(req, res) {
  const booking = await createBooking(req.body, { userId: req.user?._id });

  return sendSuccess(res, {
    status: 201,
    data: booking.toSafeObject(),
    message: "Booking created",
  });
}

export async function updateBookingHandler(req, res) {
  const booking = await updateBooking(req.params.id, req.body);

  return sendSuccess(res, {
    data: booking.toSafeObject(),
    message: "Booking updated",
  });
}

export async function updateBookingStatusHandler(req, res) {
  const booking = await updateBookingStatus(req.params.id, req.body.status);

  return sendSuccess(res, {
    data: booking.toSafeObject(),
    message: "Booking status updated",
  });
}

export async function cancelBookingHandler(req, res) {
  const booking = await cancelBooking(req.params.id);

  return sendSuccess(res, {
    data: booking.toSafeObject(),
    message: "Booking cancelled",
  });
}
