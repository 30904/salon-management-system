import Booking from "../models/Booking.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Customer from "../models/Customer.js";
import ProductMaster from "../models/ProductMaster.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import { getMyCalendar } from "./staffCalendarService.js";
import { getMyEarnings, getStaffProfileByUserId } from "./staffEarningsService.js";

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildLastSevenDayLabels() {
  const labels = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(new Date(), -offset);
    labels.push(
      date.toLocaleDateString("en-IN", {
        weekday: "short",
      })
    );
  }

  return labels;
}

async function countBookingsInRange(filter) {
  return Booking.countDocuments(filter);
}

async function buildBookingTrend() {
  const from = startOfDay(addDays(new Date(), -6));
  const to = endOfDay(new Date());

  const bookings = await Booking.find({
    start_time: { $gte: from, $lte: to },
  }).select("start_time status");

  const buckets = new Map();

  for (let offset = 6; offset >= 0; offset -= 1) {
    buckets.set(formatDayKey(addDays(new Date(), -offset)), 0);
  }

  for (const booking of bookings) {
    const key = formatDayKey(booking.start_time);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + 1);
    }
  }

  return {
    labels: buildLastSevenDayLabels(),
    values: Array.from(buckets.values()),
  };
}

async function buildServiceSplit() {
  const bookings = await Booking.find({
    start_time: { $gte: startOfDay(addDays(new Date(), -30)) },
  }).select("service_label");

  const counts = new Map();

  for (const booking of bookings) {
    const label = booking.service_label || "Other";
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    labels: sorted.map(([label]) => label),
    values: sorted.map(([, count]) => count),
  };
}

export async function getOwnerDashboard() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const now = new Date();

  const [
    todaysBookings,
    upcomingBookings,
    completedToday,
    checkedInToday,
    lowStockProducts,
    totalCustomers,
    activeStaff,
    activeUsers,
    bookingTrend,
    serviceSplit,
  ] = await Promise.all([
    countBookingsInRange({
      start_time: { $gte: todayStart, $lte: todayEnd },
    }),
    countBookingsInRange({
      start_time: { $gte: now },
      status: { $in: ["scheduled", "checked_in"] },
    }),
    countBookingsInRange({
      start_time: { $gte: todayStart, $lte: todayEnd },
      status: "completed",
    }),
    countBookingsInRange({
      start_time: { $gte: todayStart, $lte: todayEnd },
      status: "checked_in",
    }),
    ProductMaster.countDocuments({
      ...ProductMaster.lowStockFilter(),
      is_active: true,
    }),
    Customer.countDocuments(),
    StaffProfile.countDocuments({ is_active: true }),
    User.countDocuments({ is_active: true }),
    buildBookingTrend(),
    buildServiceSplit(),
  ]);

  return {
    role: "owner",
    updated_at: new Date().toISOString(),
    kpis: [
      {
        key: "todays_bookings",
        label: "Today's bookings",
        value: todaysBookings,
        hint: "Appointments scheduled for today",
        tone: "primary",
      },
      {
        key: "upcoming_bookings",
        label: "Upcoming",
        value: upcomingBookings,
        hint: "Scheduled or checked-in ahead",
        tone: "info",
      },
      {
        key: "completed_today",
        label: "Completed today",
        value: completedToday,
        hint: "Finished appointments today",
        tone: "success",
      },
      {
        key: "checked_in",
        label: "Checked in",
        value: checkedInToday,
        hint: "Clients currently in chair",
        tone: "warning",
      },
      {
        key: "low_stock",
        label: "Low stock items",
        value: lowStockProducts,
        hint: "Products at or below reorder level",
        tone: lowStockProducts > 0 ? "danger" : "success",
      },
      {
        key: "customers",
        label: "Customers",
        value: totalCustomers,
        hint: "Total customer profiles",
        tone: "neutral",
      },
      {
        key: "active_staff",
        label: "Active staff",
        value: activeStaff,
        hint: "Staff profiles on roster",
        tone: "neutral",
      },
      {
        key: "active_users",
        label: "System users",
        value: activeUsers,
        hint: "Active login accounts",
        tone: "neutral",
      },
    ],
    charts: {
      booking_trend: bookingTrend,
      service_split: serviceSplit,
    },
  };
}

export async function getStaffDashboard(userId) {
  const now = new Date();
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const weekEnd = endOfDay(addDays(now, 7));
  const trendStart = startOfDay(addDays(now, -6));

  const [calendar, earnings, profile, trendBookings] = await Promise.all([
    getMyCalendar(userId, {
      from: todayStart.toISOString(),
      to: weekEnd.toISOString(),
    }),
    getMyEarnings(userId, {}),
    getStaffProfileByUserId(userId),
    profileForTrend(userId, trendStart, todayEnd),
  ]);

  const todaysBookings = calendar.bookings.filter((booking) => {
    const start = new Date(booking.start_time);
    return start >= todayStart && start <= todayEnd;
  });

  const nextBooking = calendar.bookings.find((booking) => {
    const start = new Date(booking.start_time);
    return start >= now && !["cancelled", "completed"].includes(booking.status);
  });

  return {
    role: "staff",
    updated_at: new Date().toISOString(),
    staff: calendar.staff,
    kpis: [
      {
        key: "todays_appointments",
        label: "Today's appointments",
        value: todaysBookings.length,
        hint: "Your bookings scheduled for today",
        tone: "primary",
      },
      {
        key: "upcoming_week",
        label: "Next 7 days",
        value: calendar.summary.upcoming,
        hint: "Upcoming appointments this week",
        tone: "info",
      },
      {
        key: "completed_week",
        label: "Completed",
        value: calendar.summary.completed,
        hint: "Finished in the next 7 days window",
        tone: "success",
      },
      {
        key: "month_commission",
        label: "Commission (month)",
        value: earnings.summary.commission_total,
        hint: "Accrued commission this month",
        tone: "success",
        format: "currency",
      },
      {
        key: "month_sales",
        label: "Serviced sales",
        value: earnings.summary.sales_total,
        hint: "Line value behind your commission",
        tone: "neutral",
        format: "currency",
      },
      {
        key: "base_salary",
        label: "Base salary",
        value: earnings.summary.base_salary,
        hint: profile?.designation || "Your staff profile",
        tone: "neutral",
        format: "currency",
      },
    ],
    next_booking: nextBooking || null,
    charts: {
      booking_trend: {
        labels: buildLastSevenDayLabels(),
        values: buildStaffTrendFromBookings(trendBookings),
      },
    },
  };
}

async function profileForTrend(userId, from, to) {
  const profile = await getStaffProfileByUserId(userId);

  if (!profile) {
    return [];
  }

  const bookings = await Booking.find({
    staff_id: profile._id,
    start_time: { $gte: from, $lte: to },
  })
    .select("start_time")
    .lean();

  return bookings;
}

function buildStaffTrendFromBookings(bookings) {
  const buckets = new Map();

  for (let offset = 6; offset >= 0; offset -= 1) {
    buckets.set(formatDayKey(addDays(new Date(), -offset)), 0);
  }

  for (const booking of bookings) {
    const key = formatDayKey(new Date(booking.start_time));
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + 1);
    }
  }

  return Array.from(buckets.values());
}

export async function getDashboardForUser(user, permissions = []) {
  const canViewBilling = permissions.some(
    (permission) =>
      permission.module === "billing" && permission.action === "view"
  );

  if (canViewBilling) {
    return getOwnerDashboard();
  }

  return getStaffDashboard(user._id);
}
