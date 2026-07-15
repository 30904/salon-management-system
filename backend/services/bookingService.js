import mongoose from "mongoose";
import Booking, {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
} from "../models/Booking.js";
import Branch from "../models/Branch.js";
import Customer from "../models/Customer.js";
import ServiceMaster from "../models/ServiceMaster.js";
import StaffProfile from "../models/StaffProfile.js";
import {
  assertNoBookingConflict,
  getStylistAvailability,
} from "./bookingConflictService.js";
import {
  getBookingFeatureFlags,
  isOnlineBookingEnabled,
} from "../config/featureFlags.js";
import { AppError } from "../utils/AppError.js";

export const TERMINAL_STATUSES = ["completed", "no_show", "cancelled"];

export const STATUS_TRANSITIONS = {
  booked: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled", "no_show"],
  completed: [],
  no_show: [],
  cancelled: [],
};

function assertValidId(id, label) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

function parseDate(value, label) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} must be a valid date`, 400);
  }

  return date;
}

function parseOptionalDate(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  return parseDate(value, label);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseBookingDateFilter(value) {
  if (!value) return null;

  const date = parseDate(value, "date");
  return {
    $gte: startOfDay(date),
    $lte: endOfDay(date),
  };
}

function assertStatus(status) {
  if (!BOOKING_STATUSES.includes(status)) {
    throw new AppError(
      `status must be one of: ${BOOKING_STATUSES.join(", ")}`,
      400
    );
  }
}

function assertSource(source) {
  if (!BOOKING_SOURCES.includes(source)) {
    throw new AppError(
      `source must be one of: ${BOOKING_SOURCES.join(", ")}`,
      400
    );
  }
}

function assertOnlineBookingAllowed(source) {
  if (source === "online" && !isOnlineBookingEnabled()) {
    throw new AppError(
      "Online customer self-booking is deferred to Phase 2. Use source=internal for front-desk bookings.",
      403,
      getBookingFeatureFlags()
    );
  }
}

function assertTransition(currentStatus, nextStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `Cannot change status from ${currentStatus} to ${nextStatus}`,
      400,
      { allowed_statuses: allowed }
    );
  }
}

function assertNotTerminal(status, action = "update") {
  if (TERMINAL_STATUSES.includes(status)) {
    throw new AppError(`Cannot ${action} a ${status} booking`, 400);
  }
}

async function resolveCustomer(customerId) {
  assertValidId(customerId, "customer_id");
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  return customer;
}

async function resolveStylist(stylistId) {
  assertValidId(stylistId, "stylist_id");
  const stylist = await StaffProfile.findById(stylistId);

  if (!stylist || !stylist.is_active) {
    throw new AppError("Stylist not found", 404);
  }

  return stylist;
}

async function resolveBranch(branchId) {
  if (branchId === undefined) return undefined;
  if (branchId === null || branchId === "") return null;

  assertValidId(branchId, "branch_id");
  const branch = await Branch.findById(branchId);

  if (!branch || !branch.is_active) {
    throw new AppError("Branch not found", 404);
  }

  return branch;
}

async function resolveServices(serviceIds) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new AppError("At least one service is required", 400);
  }

  const uniqueIds = [...new Set(serviceIds.map((id) => String(id)))];

  for (const id of uniqueIds) {
    assertValidId(id, "service_id");
  }

  const services = await ServiceMaster.find({ _id: { $in: uniqueIds } });

  if (services.length !== uniqueIds.length) {
    throw new AppError("One or more services were not found", 404);
  }

  const inactive = services.find((service) => !service.is_active);

  if (inactive) {
    throw new AppError(`Service "${inactive.name}" is inactive`, 400);
  }

  const durationMinutes = services.reduce(
    (total, service) => total + service.duration_minutes,
    0
  );

  return {
    serviceIds: services.map((service) => service._id),
    durationMinutes,
  };
}

function resolveTimeWindow({
  walkIn,
  startTime,
  endTime,
  durationMinutes,
}) {
  const start = walkIn ? new Date() : parseDate(startTime, "start_time");

  let end;

  if (endTime !== undefined && endTime !== null && endTime !== "") {
    end = parseDate(endTime, "end_time");
  } else {
    end = addMinutes(start, durationMinutes);
  }

  if (end <= start) {
    throw new AppError("end_time must be after start_time", 400);
  }

  return { start, end };
}

async function loadBooking(bookingId) {
  assertValidId(bookingId, "booking id");
  const booking = await Booking.populateForDetail(Booking.findById(bookingId));

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  return booking;
}

export async function getBookingAvailability({
  stylistId,
  date,
  durationMinutes,
  excludeBookingId,
} = {}) {
  if (!stylistId) {
    throw new AppError("stylist_id is required", 400);
  }

  if (!date) {
    throw new AppError("date is required", 400);
  }

  return getStylistAvailability({
    stylistId,
    date,
    durationMinutes,
    excludeBookingId,
  });
}

export async function listBookings({
  date,
  status,
  stylistId,
  customerId,
  limit = 50,
} = {}) {
  const filter = {};

  const dateFilter = parseBookingDateFilter(date);

  if (dateFilter) {
    filter.booking_date = dateFilter;
  }

  if (status) {
    assertStatus(String(status).trim().toLowerCase());
    filter.status = status;
  }

  if (stylistId) {
    assertValidId(stylistId, "stylist_id");
    filter.stylist_id = stylistId;
  }

  if (customerId) {
    assertValidId(customerId, "customer_id");
    filter.customer_id = customerId;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  return Booking.populateForList(
    Booking.find(filter).sort({ updatedAt: -1, createdAt: -1 }).limit(safeLimit)
  );
}

export async function getBookingById(bookingId) {
  return loadBooking(bookingId);
}

export async function getBookingFeatureFlagsForApi() {
  return getBookingFeatureFlags();
}

export async function createBooking(payload, { userId = null } = {}) {
  const {
    customer_id: customerId,
    stylist_id: stylistId,
    service_ids: serviceIds,
    branch_id: branchId,
    start_time: startTime,
    end_time: endTime,
    notes,
    source = "internal",
    walk_in: walkIn = false,
    status = "booked",
  } = payload;

  if (!customerId) {
    throw new AppError("customer_id is required", 400);
  }

  if (!stylistId) {
    throw new AppError("stylist_id is required", 400);
  }

  if (!walkIn && !startTime) {
    throw new AppError("start_time is required unless walk_in is true", 400);
  }

  assertStatus(status);

  if (status !== "booked") {
    throw new AppError("New bookings must start as booked", 400);
  }

  assertSource(source);
  assertOnlineBookingAllowed(source);

  await resolveCustomer(customerId);
  await resolveStylist(stylistId);
  const branch = await resolveBranch(branchId);
  const { serviceIds: resolvedServiceIds, durationMinutes } =
    await resolveServices(serviceIds);

  const { start, end } = resolveTimeWindow({
    walkIn: Boolean(walkIn),
    startTime,
    endTime,
    durationMinutes,
  });

  await assertNoBookingConflict({
    stylistId,
    startTime: start,
    endTime: end,
  });

  const booking = await Booking.create({
    customer_id: customerId,
    branch_id: branch?._id ?? branchId ?? null,
    stylist_id: stylistId,
    service_ids: resolvedServiceIds,
    start_time: start,
    end_time: end,
    status,
    source,
    created_by: userId,
    notes: notes?.trim() || null,
  });

  return loadBooking(booking._id);
}

export async function updateBooking(bookingId, payload) {
  const booking = await loadBooking(bookingId);
  assertNotTerminal(booking.status);

  const {
    customer_id: customerId,
    stylist_id: stylistId,
    service_ids: serviceIds,
    branch_id: branchId,
    start_time: startTime,
    end_time: endTime,
    notes,
    source,
  } = payload;

  let nextCustomerId = booking.customer_id?._id || booking.customer_id;
  let nextStylistId = booking.stylist_id?._id || booking.stylist_id;
  let nextServiceIds = booking.service_ids.map(
    (service) => service?._id || service
  );
  let nextBranchId = booking.branch_id?._id || booking.branch_id;
  let nextStart = booking.start_time;
  let nextEnd = booking.end_time;

  if (customerId !== undefined) {
    await resolveCustomer(customerId);
    nextCustomerId = customerId;
  }

  if (stylistId !== undefined) {
    await resolveStylist(stylistId);
    nextStylistId = stylistId;
  }

  if (branchId !== undefined) {
    const branch = await resolveBranch(branchId);
    nextBranchId = branch?._id ?? null;
  }

  if (serviceIds !== undefined) {
    const { serviceIds: resolvedServiceIds, durationMinutes } =
      await resolveServices(serviceIds);
    nextServiceIds = resolvedServiceIds;

    if (startTime === undefined && endTime === undefined) {
      nextEnd = addMinutes(nextStart, durationMinutes);
    }
  }

  if (startTime !== undefined) {
    nextStart = parseDate(startTime, "start_time");
  }

  if (endTime !== undefined) {
    nextEnd =
      endTime === null || endTime === ""
        ? addMinutes(
            nextStart,
            (
              await resolveServices(
                serviceIds !== undefined ? serviceIds : nextServiceIds
              )
            ).durationMinutes
          )
        : parseDate(endTime, "end_time");
  } else if (startTime !== undefined && serviceIds === undefined) {
    const durationMinutes = Math.round(
      (booking.end_time.getTime() - booking.start_time.getTime()) / (60 * 1000)
    );
    nextEnd = addMinutes(nextStart, durationMinutes);
  }

  if (nextEnd <= nextStart) {
    throw new AppError("end_time must be after start_time", 400);
  }

  const scheduleChanged =
    String(nextStylistId) !== String(booking.stylist_id?._id || booking.stylist_id) ||
    nextStart.getTime() !== booking.start_time.getTime() ||
    nextEnd.getTime() !== booking.end_time.getTime() ||
    serviceIds !== undefined;

  if (scheduleChanged) {
    await assertNoBookingConflict({
      stylistId: nextStylistId,
      startTime: nextStart,
      endTime: nextEnd,
      excludeBookingId: booking._id,
    });
  }

  if (source !== undefined) {
    assertSource(source);
    assertOnlineBookingAllowed(source);
    booking.source = source;
  }

  booking.customer_id = nextCustomerId;
  booking.stylist_id = nextStylistId;
  booking.service_ids = nextServiceIds;
  booking.branch_id = nextBranchId;
  booking.start_time = nextStart;
  booking.end_time = nextEnd;

  if (notes !== undefined) {
    booking.notes = notes?.trim() || null;
  }

  await booking.save();

  return loadBooking(booking._id);
}

export async function updateBookingStatus(bookingId, status) {
  const booking = await loadBooking(bookingId);

  if (!status) {
    throw new AppError("status is required", 400);
  }

  const nextStatus = String(status).trim().toLowerCase();
  assertStatus(nextStatus);

  if (nextStatus === booking.status) {
    return booking;
  }

  assertTransition(booking.status, nextStatus);
  booking.status = nextStatus;
  await booking.save();

  return loadBooking(booking._id);
}

export async function cancelBooking(bookingId) {
  const booking = await loadBooking(bookingId);

  if (booking.status === "cancelled") {
    return booking;
  }

  if (TERMINAL_STATUSES.includes(booking.status)) {
    throw new AppError(`Cannot cancel a ${booking.status} booking`, 400);
  }

  booking.status = "cancelled";
  await booking.save();

  return loadBooking(booking._id);
}
