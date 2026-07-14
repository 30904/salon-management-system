import mongoose from "mongoose";
import Booking, { BOOKING_STATUSES } from "../models/Booking.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";

export const BLOCKING_STATUSES = ["booked", "confirmed", "in_progress"];

export const DEFAULT_SALON_HOURS = {
  start: "09:00",
  end: "20:00",
};

export const SLOT_INTERVAL_MINUTES = 15;

function assertValidObjectId(id, label) {
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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function atTimeOnDate(baseDate, timeString) {
  const [hours, minutes] = String(timeString).split(":").map(Number);
  const value = startOfDay(baseDate);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function roundUpToInterval(date, intervalMinutes = SLOT_INTERVAL_MINUTES) {
  const value = new Date(date);
  const intervalMs = intervalMinutes * 60 * 1000;
  const remainder = value.getTime() % intervalMs;

  if (remainder === 0) {
    return value;
  }

  return new Date(value.getTime() + (intervalMs - remainder));
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

async function getStylistWorkingWindow(stylistId, date) {
  const profile = await StaffProfile.findById(stylistId)
    .populate({ path: "shift_id", select: "start_time end_time is_active" })
    .lean();

  if (!profile) {
    throw new AppError("Stylist not found", 404);
  }

  if (!profile.is_active) {
    throw new AppError("Stylist is inactive", 400);
  }

  const shift = profile.shift_id;
  const start =
    shift?.is_active !== false && shift?.start_time
      ? shift.start_time
      : DEFAULT_SALON_HOURS.start;
  const end =
    shift?.is_active !== false && shift?.end_time
      ? shift.end_time
      : DEFAULT_SALON_HOURS.end;

  return {
    stylist: profile,
    day_start: atTimeOnDate(date, start),
    day_end: atTimeOnDate(date, end),
  };
}

function buildBookingFilter({ stylistId, startTime, endTime, excludeBookingId }) {
  const filter = {
    stylist_id: stylistId,
    status: { $in: BLOCKING_STATUSES },
    start_time: { $lt: endTime },
    end_time: { $gt: startTime },
  };

  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  return filter;
}

export async function findConflictingBooking({
  stylistId,
  startTime,
  endTime,
  excludeBookingId = null,
}) {
  assertValidObjectId(stylistId, "stylist id");

  const start = parseDate(startTime, "start_time");
  const end = parseDate(endTime, "end_time");

  if (end <= start) {
    throw new AppError("end_time must be after start_time", 400);
  }

  const conflict = await Booking.populateForList(
    Booking.findOne(
      buildBookingFilter({
        stylistId,
        startTime: start,
        endTime: end,
        excludeBookingId,
      })
    )
  ).lean();

  return conflict;
}

export async function getStylistDayBookings({
  stylistId,
  date,
  excludeBookingId = null,
}) {
  assertValidObjectId(stylistId, "stylist id");

  const day = parseDate(date, "date");
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const filter = {
    stylist_id: stylistId,
    status: { $in: BLOCKING_STATUSES },
    start_time: { $gte: dayStart, $lte: dayEnd },
  };

  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  return Booking.find(filter).sort({ start_time: 1 }).lean();
}

function slotFits({ candidateStart, durationMinutes, bookings, dayEnd }) {
  const candidateEnd = addMinutes(candidateStart, durationMinutes);

  if (candidateEnd > dayEnd) {
    return false;
  }

  return !bookings.some((booking) =>
    intervalsOverlap(
      candidateStart,
      candidateEnd,
      new Date(booking.start_time),
      new Date(booking.end_time)
    )
  );
}

export async function getStylistAvailability({
  stylistId,
  date,
  durationMinutes = 30,
  excludeBookingId = null,
}) {
  assertValidObjectId(stylistId, "stylist_id");

  const day = parseDate(date, "date");
  const duration = Number(durationMinutes);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError("duration_minutes must be a positive number", 400);
  }

  const { day_start: dayStart, day_end: dayEnd } = await getStylistWorkingWindow(
    stylistId,
    day
  );

  const bookings = await getStylistDayBookings({
    stylistId,
    date: day,
    excludeBookingId,
  });

  const now = new Date();
  const isToday = startOfDay(now).getTime() === startOfDay(day).getTime();

  let candidate = roundUpToInterval(dayStart, SLOT_INTERVAL_MINUTES);

  if (isToday) {
    const earliest = roundUpToInterval(
      now < dayStart ? dayStart : now,
      SLOT_INTERVAL_MINUTES
    );

    if (earliest > candidate) {
      candidate = earliest;
    }
  }

  const slots = [];
  const maxAttempts = Math.ceil(
    (dayEnd - dayStart) / (SLOT_INTERVAL_MINUTES * 60 * 1000)
  );

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    if (candidate >= dayEnd) {
      break;
    }

    if (
      slotFits({
        candidateStart: candidate,
        durationMinutes: duration,
        bookings,
        dayEnd,
      })
    ) {
      slots.push({
        start_time: candidate,
        end_time: addMinutes(candidate, duration),
      });
    }

    candidate = addMinutes(candidate, SLOT_INTERVAL_MINUTES);
  }

  return {
    stylist_id: stylistId,
    date: startOfDay(day),
    duration_minutes: duration,
    interval_minutes: SLOT_INTERVAL_MINUTES,
    working_hours: {
      start: dayStart,
      end: dayEnd,
    },
    slots,
    booked_slots: bookings.map((booking) => ({
      id: booking._id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status,
    })),
  };
}

export async function suggestNextAvailableSlot({
  stylistId,
  requestedStart,
  durationMinutes,
  excludeBookingId = null,
}) {
  assertValidObjectId(stylistId, "stylist id");

  const start = parseDate(requestedStart, "requested_start");
  const duration = Number(durationMinutes);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError("duration_minutes must be a positive number", 400);
  }

  const { day_start: dayStart, day_end: dayEnd } = await getStylistWorkingWindow(
    stylistId,
    start
  );

  const bookings = await getStylistDayBookings({
    stylistId,
    date: start,
    excludeBookingId,
  });

  let candidate = roundUpToInterval(
    start < dayStart ? dayStart : start,
    SLOT_INTERVAL_MINUTES
  );

  const maxAttempts = Math.ceil((dayEnd - dayStart) / (SLOT_INTERVAL_MINUTES * 60 * 1000));

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    if (candidate >= dayEnd) {
      break;
    }

    if (
      slotFits({
        candidateStart: candidate,
        durationMinutes: duration,
        bookings,
        dayEnd,
      })
    ) {
      return {
        start_time: candidate,
        end_time: addMinutes(candidate, duration),
      };
    }

    const blockingBooking = bookings.find((booking) =>
      intervalsOverlap(
        candidate,
        addMinutes(candidate, duration),
        new Date(booking.start_time),
        new Date(booking.end_time)
      )
    );

    candidate = roundUpToInterval(
      blockingBooking
        ? new Date(blockingBooking.end_time)
        : addMinutes(candidate, SLOT_INTERVAL_MINUTES),
      SLOT_INTERVAL_MINUTES
    );
  }

  return null;
}

function formatConflict(conflict) {
  if (!conflict) {
    return null;
  }

  return {
    id: conflict._id,
    start_time: conflict.start_time,
    end_time: conflict.end_time,
    status: conflict.status,
    customer_name: conflict.customer_id?.name || null,
    service_label:
      conflict.service_ids?.map((service) => service.name).join(", ") || null,
  };
}

export async function checkBookingConflict({
  stylistId,
  startTime,
  endTime,
  excludeBookingId = null,
}) {
  const start = parseDate(startTime, "start_time");
  const end = parseDate(endTime, "end_time");
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));

  const conflict = await findConflictingBooking({
    stylistId,
    startTime: start,
    endTime: end,
    excludeBookingId,
  });

  const suggestion = conflict
    ? await suggestNextAvailableSlot({
        stylistId,
        requestedStart: start,
        durationMinutes,
        excludeBookingId,
      })
    : null;

  return {
    has_conflict: Boolean(conflict),
    conflict: formatConflict(conflict),
    suggestion,
    blocking_statuses: BLOCKING_STATUSES,
    valid_statuses: BOOKING_STATUSES,
  };
}

export async function assertNoBookingConflict({
  stylistId,
  startTime,
  endTime,
  excludeBookingId = null,
}) {
  const result = await checkBookingConflict({
    stylistId,
    startTime,
    endTime,
    excludeBookingId,
  });

  if (!result.has_conflict) {
    return result;
  }

  throw new AppError("Stylist already has a booking in this time slot", 409, {
    conflict: result.conflict,
    suggestion: result.suggestion,
  });
}
