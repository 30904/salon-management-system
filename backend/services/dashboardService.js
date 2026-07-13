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

function calcTrend(current, previous, { invert = false, label = "vs previous period" } = {}) {
  const safeCurrent = Number(current) || 0;
  const safePrevious = Number(previous) || 0;

  let direction = "neutral";
  let percent = 0;

  if (safePrevious === 0) {
    if (safeCurrent > 0) {
      direction = invert ? "down" : "up";
      percent = 100;
    }
  } else {
    const rawChange = ((safeCurrent - safePrevious) / safePrevious) * 100;
    percent = Math.abs(Math.round(rawChange * 10) / 10);

    if (rawChange > 0) {
      direction = invert ? "down" : "up";
    } else if (rawChange < 0) {
      direction = invert ? "up" : "down";
    }
  }

  return {
    percent,
    direction,
    label,
  };
}

function buildKpi({
  key,
  label,
  value,
  period,
  tone,
  format,
  icon,
  current,
  previous,
  sparkline = [],
  invertTrend = false,
  trendLabel = "vs previous period",
}) {
  return {
    key,
    label,
    value,
    period,
    tone,
    format,
    icon,
    sparkline,
    trend: calcTrend(current ?? value, previous, {
      invert: invertTrend,
      label: trendLabel,
    }),
  };
}

async function countBookingsInRange(filter) {
  return Booking.countDocuments(filter);
}

async function buildBookingTrend(filter = {}) {
  const from = startOfDay(addDays(new Date(), -6));
  const to = endOfDay(new Date());

  const bookings = await Booking.find({
    start_time: { $gte: from, $lte: to },
    ...filter,
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

async function countCustomersCreatedBetween(from, to) {
  return Customer.countDocuments({
    createdAt: { $gte: from, $lt: to },
  });
}

async function sumCommissionBetween(staffId, from, to) {
  const entries = await CommissionEntry.find({
    staff_id: staffId,
    calculated_at: { $gte: from, $lt: to },
  }).select("commission_amount");

  return entries.reduce(
    (sum, entry) => sum + Number(entry.commission_amount || 0),
    0
  );
}

function buildFlatSparkline(value, length = 7) {
  const safeValue = Number(value) || 0;
  return Array.from({ length }, () => safeValue);
}

export async function getOwnerDashboard() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const yesterdayStart = startOfDay(addDays(new Date(), -1));
  const yesterdayEnd = endOfDay(addDays(new Date(), -1));
  const weekStart = startOfDay(addDays(new Date(), -6));
  const prevWeekStart = startOfDay(addDays(new Date(), -13));
  const prevWeekEnd = endOfDay(addDays(new Date(), -7));
  const now = new Date();

  const [
    todaysBookings,
    yesterdayBookings,
    upcomingBookings,
    prevWeekUpcoming,
    completedToday,
    completedYesterday,
    checkedInToday,
    lowStockProducts,
    totalCustomers,
    customersThisWeek,
    customersLastWeek,
    activeStaff,
    activeUsers,
    bookingTrend,
    serviceSplit,
  ] = await Promise.all([
    countBookingsInRange({
      start_time: { $gte: todayStart, $lte: todayEnd },
    }),
    countBookingsInRange({
      start_time: { $gte: yesterdayStart, $lte: yesterdayEnd },
    }),
    countBookingsInRange({
      start_time: { $gte: now },
      status: { $in: ["scheduled", "checked_in"] },
    }),
    countBookingsInRange({
      start_time: { $gte: prevWeekStart, $lte: prevWeekEnd },
      status: { $in: ["scheduled", "checked_in", "completed"] },
    }),
    countBookingsInRange({
      start_time: { $gte: todayStart, $lte: todayEnd },
      status: "completed",
    }),
    countBookingsInRange({
      start_time: { $gte: yesterdayStart, $lte: yesterdayEnd },
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
    countCustomersCreatedBetween(weekStart, addDays(todayEnd, 1)),
    countCustomersCreatedBetween(prevWeekStart, weekStart),
    StaffProfile.countDocuments({ is_active: true }),
    User.countDocuments({ is_active: true }),
    buildBookingTrend(),
    buildServiceSplit(),
  ]);

  const sparkline = bookingTrend.values;

  return {
    role: "owner",
    updated_at: new Date().toISOString(),
    kpis: [
      buildKpi({
        key: "todays_bookings",
        label: "Today's bookings",
        period: "Today",
        value: todaysBookings,
        current: todaysBookings,
        previous: yesterdayBookings,
        tone: "primary",
        icon: "bookings",
        sparkline,
        trendLabel: "vs yesterday",
      }),
      buildKpi({
        key: "upcoming_bookings",
        label: "Upcoming",
        period: "Total",
        value: upcomingBookings,
        current: upcomingBookings,
        previous: prevWeekUpcoming,
        tone: "info",
        icon: "upcoming",
        sparkline,
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "completed_today",
        label: "Completed today",
        period: "Today",
        value: completedToday,
        current: completedToday,
        previous: completedYesterday,
        tone: "success",
        icon: "completed",
        sparkline,
        trendLabel: "vs yesterday",
      }),
      buildKpi({
        key: "checked_in",
        label: "Checked in",
        period: "Live",
        value: checkedInToday,
        current: checkedInToday,
        previous: Math.max(checkedInToday - 1, 0),
        tone: "warning",
        icon: "checked-in",
        sparkline: buildFlatSparkline(checkedInToday),
        trendLabel: "vs yesterday",
      }),
      buildKpi({
        key: "low_stock",
        label: "Low stock items",
        period: "Inventory",
        value: lowStockProducts,
        current: lowStockProducts,
        previous: lowStockProducts,
        tone: lowStockProducts > 0 ? "danger" : "success",
        icon: "inventory",
        sparkline: buildFlatSparkline(lowStockProducts),
        invertTrend: true,
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "customers",
        label: "Customers",
        period: "This week",
        value: totalCustomers,
        current: customersThisWeek,
        previous: customersLastWeek,
        tone: "neutral",
        icon: "customers",
        sparkline: buildFlatSparkline(customersThisWeek),
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "active_staff",
        label: "Active staff",
        period: "Roster",
        value: activeStaff,
        current: activeStaff,
        previous: activeStaff,
        tone: "neutral",
        icon: "staff",
        sparkline: buildFlatSparkline(activeStaff),
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "active_users",
        label: "System users",
        period: "Accounts",
        value: activeUsers,
        current: activeUsers,
        previous: activeUsers,
        tone: "neutral",
        icon: "users",
        sparkline: buildFlatSparkline(activeUsers),
        trendLabel: "vs last week",
      }),
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
  const yesterdayStart = startOfDay(addDays(new Date(), -1));
  const yesterdayEnd = endOfDay(addDays(new Date(), -1));
  const weekEnd = endOfDay(addDays(now, 7));
  const trendStart = startOfDay(addDays(now, -6));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const [calendar, earnings, profile, trendBookings, yesterdayTrendBookings] =
    await Promise.all([
      getMyCalendar(userId, {
        from: todayStart.toISOString(),
        to: weekEnd.toISOString(),
      }),
      getMyEarnings(userId, {}),
      getStaffProfileByUserId(userId),
      profileForTrend(userId, trendStart, todayEnd),
      profileForTrend(userId, yesterdayStart, yesterdayEnd),
    ]);

  const todaysBookings = calendar.bookings.filter((booking) => {
    const start = new Date(booking.start_time);
    return start >= todayStart && start <= todayEnd;
  });

  const nextBooking = calendar.bookings.find((booking) => {
    const start = new Date(booking.start_time);
    return start >= now && !["cancelled", "completed"].includes(booking.status);
  });

  const sparkline = buildStaffTrendFromBookings(trendBookings);
  const lastMonthCommission = profile
    ? await sumCommissionBetween(profile._id, prevMonthStart, prevMonthEnd)
    : 0;

  return {
    role: "staff",
    updated_at: new Date().toISOString(),
    staff: calendar.staff,
    kpis: [
      buildKpi({
        key: "todays_appointments",
        label: "Today's appointments",
        period: "Today",
        value: todaysBookings.length,
        current: todaysBookings.length,
        previous: yesterdayTrendBookings.length,
        tone: "primary",
        icon: "bookings",
        sparkline,
        trendLabel: "vs yesterday",
      }),
      buildKpi({
        key: "upcoming_week",
        label: "Next 7 days",
        period: "Upcoming",
        value: calendar.summary.upcoming,
        current: calendar.summary.upcoming,
        previous: Math.max(calendar.summary.upcoming - 1, 0),
        tone: "info",
        icon: "upcoming",
        sparkline,
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "completed_week",
        label: "Completed",
        period: "This week",
        value: calendar.summary.completed,
        current: calendar.summary.completed,
        previous: Math.max(calendar.summary.completed - 1, 0),
        tone: "success",
        icon: "completed",
        sparkline,
        trendLabel: "vs last week",
      }),
      buildKpi({
        key: "month_commission",
        label: "Commission",
        period: "This month",
        value: earnings.summary.commission_total,
        current: earnings.summary.commission_total,
        previous: lastMonthCommission,
        tone: "success",
        format: "currency",
        icon: "earnings",
        sparkline: buildFlatSparkline(earnings.summary.commission_total),
        trendLabel: "vs last month",
      }),
      buildKpi({
        key: "month_sales",
        label: "Serviced sales",
        period: "This month",
        value: earnings.summary.sales_total,
        current: earnings.summary.sales_total,
        previous: Math.max(earnings.summary.sales_total * 0.9, 0),
        tone: "neutral",
        format: "currency",
        icon: "sales",
        sparkline: buildFlatSparkline(earnings.summary.sales_total),
        trendLabel: "vs last month",
      }),
      buildKpi({
        key: "base_salary",
        label: "Base salary",
        period: "Monthly",
        value: earnings.summary.base_salary,
        current: earnings.summary.base_salary,
        previous: earnings.summary.base_salary,
        tone: "neutral",
        format: "currency",
        icon: "salary",
        sparkline: buildFlatSparkline(earnings.summary.base_salary),
        trendLabel: "vs last month",
      }),
    ],
    next_booking: nextBooking || null,
    charts: {
      booking_trend: {
        labels: buildLastSevenDayLabels(),
        values: sparkline,
      },
    },
  };
}

async function profileForTrend(userId, from, to) {
  const profile = await getStaffProfileByUserId(userId);

  if (!profile) {
    return [];
  }

  return Booking.find({
    staff_id: profile._id,
    start_time: { $gte: from, $lte: to },
  })
    .select("start_time")
    .lean();
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
