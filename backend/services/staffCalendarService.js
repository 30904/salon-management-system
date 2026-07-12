import Booking from "../models/Booking.js";
import { getStaffProfileByUserId } from "./staffEarningsService.js";
import { AppError } from "../utils/AppError.js";

function parseDateWindow(query = {}) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setHours(0, 0, 0, 0);

  const defaultTo = new Date(defaultFrom);
  defaultTo.setDate(defaultTo.getDate() + 14);

  const from = query.from ? new Date(query.from) : defaultFrom;
  const to = query.to ? new Date(query.to) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("from and to must be valid dates", 400);
  }

  if (from >= to) {
    throw new AppError("from must be before to", 400);
  }

  return { from, to };
}

export async function getMyCalendar(userId, query = {}) {
  const profile = await getStaffProfileByUserId(userId);
  const { from, to } = parseDateWindow(query);

  if (!profile) {
    return {
      staff: null,
      range: { from, to },
      bookings: [],
      summary: { total: 0, upcoming: 0, completed: 0, cancelled: 0 },
    };
  }

  const bookings = await Booking.find({
    staff_id: profile._id,
    start_time: { $gte: from, $lt: to },
  }).sort({ start_time: 1 });

  const summary = bookings.reduce(
    (acc, booking) => {
      acc.total += 1;

      if (booking.status === "completed") {
        acc.completed += 1;
      } else if (booking.status === "cancelled") {
        acc.cancelled += 1;
      } else {
        acc.upcoming += 1;
      }

      return acc;
    },
    { total: 0, upcoming: 0, completed: 0, cancelled: 0 }
  );

  return {
    staff: profile.toSafeObject(),
    range: { from, to },
    bookings: bookings.map((booking) => booking.toSafeObject()),
    summary,
  };
}
