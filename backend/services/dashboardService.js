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

function facetCount(result, key) {
  return result?.[key]?.[0]?.count || 0;
}

function facetSum(result, key) {
  return result?.[key]?.[0]?.total || 0;
}

async function buildOwnerBookingSnapshot() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const yesterdayStart = startOfDay(addDays(new Date(), -1));
  const yesterdayEnd = endOfDay(addDays(new Date(), -1));
  const weekStart = startOfDay(addDays(new Date(), -6));
  const prevWeekStart = startOfDay(addDays(new Date(), -13));
  const prevWeekEnd = endOfDay(addDays(new Date(), -7));
  const monthStart = startOfDay(addDays(new Date(), -30));
  const now = new Date();

  const [kpiCounts, weekBookings, serviceRows, upcomingAppointments] =
    await Promise.all([
      Booking.aggregate([
        {
          $facet: {
            todays: [
              {
                $match: {
                  start_time: { $gte: todayStart, $lte: todayEnd },
                },
              },
              { $count: "count" },
            ],
            yesterday: [
              {
                $match: {
                  start_time: { $gte: yesterdayStart, $lte: yesterdayEnd },
                },
              },
              { $count: "count" },
            ],
            upcoming: [
              {
                $match: {
                  start_time: { $gte: now },
                  status: { $in: ["scheduled", "checked_in"] },
                },
              },
              { $count: "count" },
            ],
            prev_week_upcoming: [
              {
                $match: {
                  start_time: { $gte: prevWeekStart, $lte: prevWeekEnd },
                  status: { $in: ["scheduled", "checked_in", "completed"] },
                },
              },
              { $count: "count" },
            ],
            completed_today: [
              {
                $match: {
                  start_time: { $gte: todayStart, $lte: todayEnd },
                  status: "completed",
                },
              },
              { $count: "count" },
            ],
            completed_yesterday: [
              {
                $match: {
                  start_time: { $gte: yesterdayStart, $lte: yesterdayEnd },
                  status: "completed",
                },
              },
              { $count: "count" },
            ],
            checked_in_today: [
              {
                $match: {
                  start_time: { $gte: todayStart, $lte: todayEnd },
                  status: "checked_in",
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      Booking.find({
        start_time: { $gte: weekStart, $lte: todayEnd },
      })
        .select("start_time status")
        .lean(),
      Booking.aggregate([
        {
          $match: {
            start_time: { $gte: monthStart },
          },
        },
        {
          $group: {
            _id: { $ifNull: ["$service_label", "Other"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      buildUpcomingAppointments(),
    ]);

  const counts = kpiCounts[0] || {};
  const buckets = new Map();

  for (let offset = 6; offset >= 0; offset -= 1) {
    buckets.set(formatDayKey(addDays(new Date(), -offset)), 0);
  }

  const statusOrder = [
    { key: "scheduled", label: "Scheduled" },
    { key: "checked_in", label: "Checked in" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "no_show", label: "No show" },
  ];
  const statusCounts = Object.fromEntries(statusOrder.map(({ key }) => [key, 0]));

  for (const booking of weekBookings) {
    const key = formatDayKey(booking.start_time);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + 1);
    }

    if (statusCounts[booking.status] !== undefined) {
      statusCounts[booking.status] += 1;
    }
  }

  return {
    todaysBookings: facetCount(counts, "todays"),
    yesterdayBookings: facetCount(counts, "yesterday"),
    upcomingBookings: facetCount(counts, "upcoming"),
    prevWeekUpcoming: facetCount(counts, "prev_week_upcoming"),
    completedToday: facetCount(counts, "completed_today"),
    completedYesterday: facetCount(counts, "completed_yesterday"),
    checkedInToday: facetCount(counts, "checked_in_today"),
    bookingTrend: {
      labels: buildLastSevenDayLabels(),
      values: Array.from(buckets.values()),
    },
    bookingStatusBreakdown: {
      labels: statusOrder.map(({ label }) => label),
      values: statusOrder.map(({ key }) => statusCounts[key]),
    },
    serviceSplit: {
      labels: serviceRows.map((row) => row._id),
      values: serviceRows.map((row) => row.count),
    },
    upcomingAppointments,
  };
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
  const serviceRows = await Booking.aggregate([
    {
      $match: {
        start_time: { $gte: startOfDay(addDays(new Date(), -30)) },
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$service_label", "Other"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  return {
    labels: serviceRows.map((row) => row._id),
    values: serviceRows.map((row) => row.count),
  };
}

async function buildUpcomingAppointments(limit = 6) {
  const bookings = await Booking.find({
    start_time: { $gte: new Date() },
    status: { $in: ["scheduled", "checked_in"] },
  })
    .sort({ start_time: 1 })
    .limit(limit)
    .populate({
      path: "staff_id",
      select: "user_id",
      populate: { path: "user_id", select: "name" },
    })
    .lean();

  return bookings.map((booking) => ({
    id: booking._id,
    customer_name: booking.customer_name,
    service_label: booking.service_label,
    start_time: booking.start_time,
    status: booking.status,
    staff_name: booking.staff_id?.user_id?.name || "Unassigned",
  }));
}

async function buildNeedsAttention() {
  const weekStart = startOfDay(addDays(new Date(), -7));

  const [lowStockFacet, issueFacet] = await Promise.all([
    ProductMaster.aggregate([
      { $match: ProductMaster.lowStockFilter() },
      {
        $facet: {
          items: [
            { $sort: { current_stock: 1 } },
            { $limit: 5 },
            {
              $project: {
                name: 1,
                sku: 1,
                current_stock: 1,
                reorder_level: 1,
                unit: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          start_time: { $gte: weekStart },
          status: { $in: ["cancelled", "no_show"] },
        },
      },
      {
        $facet: {
          recent: [
            { $sort: { start_time: -1 } },
            { $limit: 5 },
            {
              $project: {
                customer_name: 1,
                service_label: 1,
                status: 1,
                start_time: 1,
              },
            },
          ],
          counts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const lowStock = lowStockFacet[0] || { items: [], total: [] };
  const issues = issueFacet[0] || { recent: [], counts: [] };
  const countByStatus = Object.fromEntries(
    (issues.counts || []).map((row) => [row._id, row.count])
  );

  return {
    summary: {
      low_stock_count: lowStock.total?.[0]?.count || 0,
      cancelled_count: countByStatus.cancelled || 0,
      no_show_count: countByStatus.no_show || 0,
    },
    low_stock: (lowStock.items || []).map((product) => ({
      id: product._id,
      name: product.name,
      sku: product.sku,
      current_stock: product.current_stock,
      reorder_level: product.reorder_level,
      unit: product.unit,
    })),
    issues: (issues.recent || []).map((booking) => ({
      id: booking._id,
      customer_name: booking.customer_name,
      service_label: booking.service_label,
      status: booking.status,
      start_time: booking.start_time,
    })),
  };
}

async function buildBookingStatusBreakdown(filter = {}) {
  const from = startOfDay(addDays(new Date(), -6));
  const to = endOfDay(new Date());

  const bookings = await Booking.find({
    start_time: { $gte: from, $lte: to },
    ...filter,
  }).select("status");

  const statusOrder = [
    { key: "scheduled", label: "Scheduled" },
    { key: "checked_in", label: "Checked in" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "no_show", label: "No show" },
  ];

  const counts = Object.fromEntries(statusOrder.map(({ key }) => [key, 0]));

  for (const booking of bookings) {
    if (counts[booking.status] !== undefined) {
      counts[booking.status] += 1;
    }
  }

  return {
    labels: statusOrder.map(({ label }) => label),
    values: statusOrder.map(({ key }) => counts[key]),
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

async function buildSalesSummary(filter = {}) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const yesterdayStart = startOfDay(addDays(new Date(), -1));
  const yesterdayEnd = endOfDay(addDays(new Date(), -1));
  const yearStart = new Date(todayStart.getFullYear(), 0, 1);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const lastYearStart = new Date(todayStart.getFullYear() - 1, 0, 1);
  const lastYearToDate = new Date(todayEnd);
  lastYearToDate.setFullYear(todayEnd.getFullYear() - 1);
  const lastMonthStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth() - 1,
    1
  );
  const lastMonthToDate = new Date(todayEnd);
  lastMonthToDate.setMonth(todayEnd.getMonth() - 1);

  const [result] = await CommissionEntry.aggregate([
    {
      $match: {
        calculated_at: { $gte: lastYearStart, $lte: todayEnd },
        ...filter,
      },
    },
    {
      $facet: {
        year_to_date: [
          { $match: { calculated_at: { $gte: yearStart } } },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
        prev_year_to_date: [
          {
            $match: {
              calculated_at: { $gte: lastYearStart, $lte: lastYearToDate },
            },
          },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
        month_to_date: [
          { $match: { calculated_at: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
        prev_month_to_date: [
          {
            $match: {
              calculated_at: { $gte: lastMonthStart, $lte: lastMonthToDate },
            },
          },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
        today: [
          {
            $match: {
              calculated_at: { $gte: todayStart, $lte: todayEnd },
            },
          },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
        yesterday: [
          {
            $match: {
              calculated_at: { $gte: yesterdayStart, $lte: yesterdayEnd },
            },
          },
          { $group: { _id: null, total: { $sum: "$line_amount" } } },
        ],
      },
    },
  ]);

  const yearToDate = facetSum(result, "year_to_date");
  const prevYearToDate = facetSum(result, "prev_year_to_date");
  const monthToDate = facetSum(result, "month_to_date");
  const prevMonthToDate = facetSum(result, "prev_month_to_date");
  const todaySales = facetSum(result, "today");
  const yesterdaySales = facetSum(result, "yesterday");

  return {
    year_to_date: buildSalesMetric({
      current: yearToDate,
      previous: prevYearToDate,
      label: "vs last year",
    }),
    month_to_date: buildSalesMetric({
      current: monthToDate,
      previous: prevMonthToDate,
      label: "vs last month",
    }),
    today: buildSalesMetric({
      current: todaySales,
      previous: yesterdaySales,
      label: "vs yesterday",
    }),
  };
}

function buildSalesMetric({ current, previous, label }) {
  return {
    value: Number(current) || 0,
    has_comparison: Number(previous) > 0,
    trend: calcTrend(current, previous, { label }),
  };
}

function buildFlatSparkline(value, length = 7) {
  const safeValue = Number(value) || 0;
  return Array.from({ length }, () => safeValue);
}

export async function getOwnerDashboard() {
  const todayEnd = endOfDay();
  const weekStart = startOfDay(addDays(new Date(), -6));
  const prevWeekStart = startOfDay(addDays(new Date(), -13));

  const [
    bookingSnapshot,
    customerCounts,
    activeStaff,
    activeUsers,
    needsAttention,
    salesSummary,
  ] = await Promise.all([
    buildOwnerBookingSnapshot(),
    Customer.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          this_week: [
            {
              $match: {
                createdAt: { $gte: weekStart, $lt: addDays(todayEnd, 1) },
              },
            },
            { $count: "count" },
          ],
          last_week: [
            {
              $match: {
                createdAt: { $gte: prevWeekStart, $lt: weekStart },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]),
    StaffProfile.countDocuments({ is_active: true }),
    User.countDocuments({ is_active: true }),
    buildNeedsAttention(),
    buildSalesSummary(),
  ]);

  const customerFacet = customerCounts[0] || {};
  const totalCustomers = facetCount(customerFacet, "total");
  const customersThisWeek = facetCount(customerFacet, "this_week");
  const customersLastWeek = facetCount(customerFacet, "last_week");

  const {
    todaysBookings,
    yesterdayBookings,
    upcomingBookings,
    prevWeekUpcoming,
    completedToday,
    completedYesterday,
    checkedInToday,
    bookingTrend,
    bookingStatusBreakdown,
    serviceSplit,
    upcomingAppointments,
  } = bookingSnapshot;

  const lowStockProducts = needsAttention.summary.low_stock_count;
  const sparkline = bookingTrend.values;

  return {
    role: "owner",
    updated_at: new Date().toISOString(),
    sales: salesSummary,
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
      booking_status_breakdown: bookingStatusBreakdown,
    },
    panels: {
      upcoming_appointments: upcomingAppointments,
      needs_attention: needsAttention,
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

  const [upcomingAppointments, needsAttention, bookingStatusBreakdown] =
    await Promise.all([
      Promise.resolve(
        calendar.bookings
          .filter((booking) => {
            const start = new Date(booking.start_time);
            return (
              start >= now &&
              !["cancelled", "completed", "no_show"].includes(booking.status)
            );
          })
          .slice(0, 6)
          .map((booking) => ({
            id: booking.id || booking._id,
            customer_name: booking.customer_name,
            service_label: booking.service_label,
            start_time: booking.start_time,
            status: booking.status,
            staff_name: calendar.staff?.user?.name || "You",
          }))
      ),
      Promise.resolve({
        summary: {
          low_stock_count: 0,
          cancelled_count: calendar.bookings.filter(
            (booking) => booking.status === "cancelled"
          ).length,
          no_show_count: calendar.bookings.filter(
            (booking) => booking.status === "no_show"
          ).length,
        },
        low_stock: [],
        issues: calendar.bookings
          .filter((booking) =>
            ["cancelled", "no_show"].includes(booking.status)
          )
          .slice(0, 5)
          .map((booking) => ({
            id: booking.id || booking._id,
            customer_name: booking.customer_name,
            service_label: booking.service_label,
            status: booking.status,
            start_time: booking.start_time,
          })),
      }),
      profile
        ? buildBookingStatusBreakdown({ staff_id: profile._id })
        : Promise.resolve({ labels: [], values: [] }),
    ]);

  const salesSummary = profile
    ? await buildSalesSummary({ staff_id: profile._id })
    : null;

  return {
    role: "staff",
    updated_at: new Date().toISOString(),
    sales: salesSummary,
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
      booking_status_breakdown: bookingStatusBreakdown,
    },
    panels: {
      upcoming_appointments: upcomingAppointments,
      needs_attention: needsAttention,
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
