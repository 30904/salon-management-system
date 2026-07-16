import Attendance from "../models/Attendance.js";
import Booking from "../models/Booking.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Customer from "../models/Customer.js";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import ProductMaster from "../models/ProductMaster.js";
import StaffProfile from "../models/StaffProfile.js";

function startOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function endOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function previousMonth(year, month) {
  const d = new Date(Date.UTC(year, month - 2, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function calcTrend(current, previous, { invert = false, label = "vs last month" } = {}) {
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
    if (rawChange > 0) direction = invert ? "down" : "up";
    else if (rawChange < 0) direction = invert ? "up" : "down";
  }

  return { percent, direction, label };
}

function round2(n) {
  return Number((Number(n) || 0).toFixed(2));
}

function formatPeriodLabel(month, year) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildDailyLabels(year, month) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const labels = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    labels.push(
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" })
    );
  }
  return labels;
}

function mapDailyValues(year, month, rows, valueKey = "total") {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const map = new Map(rows.map((r) => [r._id, r[valueKey] || 0]));
  const values = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    values.push(round2(map.get(key) || 0));
  }
  return values;
}

async function aggregateInvoiceSummary(start, end) {
  const [result] = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lte: end },
        payment_status: { $ne: "void" },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$totals.grand_total" },
        invoice_count: { $sum: 1 },
        gst: { $sum: "$totals.tax_total" },
        outstanding: { $sum: "$totals.amount_due" },
        discount: { $sum: "$totals.discount_total" },
        customers: { $addToSet: "$customer_id" },
      },
    },
  ]);

  if (!result) {
    return {
      revenue: 0,
      invoice_count: 0,
      gst: 0,
      outstanding: 0,
      discount: 0,
      customers_served: 0,
      avg_ticket: 0,
    };
  }

  const invoiceCount = result.invoice_count || 0;
  return {
    revenue: round2(result.revenue),
    invoice_count: invoiceCount,
    gst: round2(result.gst),
    outstanding: round2(result.outstanding),
    discount: round2(result.discount),
    customers_served: (result.customers || []).filter(Boolean).length,
    avg_ticket: invoiceCount ? round2(result.revenue / invoiceCount) : 0,
  };
}

async function aggregateRevenueTrend(start, end, year, month) {
  const rows = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lte: end },
        payment_status: { $ne: "void" },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$billing_date", timezone: "UTC" },
        },
        total: { $sum: "$totals.grand_total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: buildDailyLabels(year, month),
    values: mapDailyValues(year, month, rows, "total"),
    invoice_counts: mapDailyValues(year, month, rows, "count"),
  };
}

async function aggregatePaymentModes(start, end) {
  const rows = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lte: end },
        payment_status: { $ne: "void" },
      },
    },
    {
      $group: {
        _id: "$payment_mode",
        total: { $sum: "$totals.grand_total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const labelMap = {
    cash: "Cash",
    card: "Card",
    upi: "UPI",
    package_credits: "Package Credits",
    split: "Split",
    other: "Other",
  };

  return {
    labels: rows.map((r) => labelMap[r._id] || r._id || "Unknown"),
    values: rows.map((r) => round2(r.total)),
    counts: rows.map((r) => r.count),
  };
}

async function aggregateRevenueByCategory(start, end) {
  const rows = await InvoiceLineItem.aggregate([
    {
      $lookup: {
        from: "invoices",
        localField: "invoice_id",
        foreignField: "_id",
        as: "invoice",
      },
    },
    { $unwind: "$invoice" },
    {
      $match: {
        "invoice.billing_date": { $gte: start, $lte: end },
        "invoice.payment_status": { $ne: "void" },
      },
    },
    {
      $group: {
        _id: "$item_type",
        total: { $sum: "$total_amount" },
        count: { $sum: "$quantity" },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const labelMap = {
    service: "Services",
    product: "Retail Products",
    package: "Packages",
    custom: "Custom Items",
  };

  return {
    labels: rows.map((r) => labelMap[r._id] || r._id),
    values: rows.map((r) => round2(r.total)),
    counts: rows.map((r) => r.count),
  };
}

async function aggregateBookingStats(start, end) {
  const [statusRows, totalRow] = await Promise.all([
    Booking.aggregate([
      { $match: { start_time: { $gte: start, $lte: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Booking.countDocuments({ start_time: { $gte: start, $lte: end } }),
  ]);

  const statusMap = Object.fromEntries(statusRows.map((r) => [r._id, r.count]));
  const completed = statusMap.completed || 0;
  const cancelled = statusMap.cancelled || 0;
  const noShow = statusMap.no_show || 0;
  const booked = totalRow || 0;

  return {
    total: booked,
    completed,
    cancelled,
    no_show: noShow,
    no_show_rate: booked ? round2((noShow / booked) * 100) : 0,
    cancellation_rate: booked ? round2((cancelled / booked) * 100) : 0,
    completion_rate: booked ? round2((completed / booked) * 100) : 0,
    status_breakdown: {
      labels: ["Completed", "Confirmed", "Booked", "Cancelled", "No Show", "In Progress"],
      values: [
        statusMap.completed || 0,
        statusMap.confirmed || 0,
        statusMap.booked || 0,
        statusMap.cancelled || 0,
        statusMap.no_show || 0,
        statusMap.in_progress || 0,
      ],
    },
  };
}

async function aggregateBookingTrend(start, end, year, month) {
  const rows = await Booking.aggregate([
    { $match: { start_time: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$start_time", timezone: "UTC" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: buildDailyLabels(year, month),
    values: mapDailyValues(year, month, rows, "count"),
  };
}

async function aggregatePeakHours(start, end) {
  const rows = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lte: end },
        payment_status: { $ne: "void" },
      },
    },
    {
      $group: {
        _id: { $hour: "$billing_date" },
        total: { $sum: "$totals.grand_total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const labels = [];
  const values = [];
  for (let hour = 9; hour <= 21; hour++) {
    const row = rows.find((r) => r._id === hour);
    labels.push(`${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "PM" : "AM"}`);
    values.push(round2(row?.total || 0));
  }

  return { labels, values };
}

async function aggregateWeekdayLoad(start, end) {
  const rows = await Booking.aggregate([
    { $match: { start_time: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dayOfWeek: "$start_time" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return {
    labels: dayNames,
    values: [1, 2, 3, 4, 5, 6, 7].map((d) => map[d] || 0),
  };
}

async function aggregateStaffLeaderboard(start, end) {
  const rows = await CommissionEntry.aggregate([
    {
      $match: {
        calculated_at: { $gte: start, $lte: end },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$staff_id",
        sales: { $sum: "$line_amount" },
        commission: { $sum: "$commission_amount" },
        services: { $sum: 1 },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 12 },
    {
      $lookup: {
        from: "staffprofiles",
        localField: "_id",
        foreignField: "_id",
        as: "staff",
      },
    },
    { $unwind: { path: "$staff", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "staff.user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((row, index) => ({
    rank: index + 1,
    staff_id: row._id,
    name: row.user?.name || row.staff?.designation || "Staff",
    designation: row.staff?.designation || "—",
    sales: round2(row.sales),
    commission: round2(row.commission),
    services_count: row.services,
  }));
}

async function aggregateTopServices(start, end) {
  const rows = await InvoiceLineItem.aggregate([
    {
      $lookup: {
        from: "invoices",
        localField: "invoice_id",
        foreignField: "_id",
        as: "invoice",
      },
    },
    { $unwind: "$invoice" },
    {
      $match: {
        item_type: "service",
        "invoice.billing_date": { $gte: start, $lte: end },
        "invoice.payment_status": { $ne: "void" },
      },
    },
    {
      $group: {
        _id: "$item_name",
        revenue: { $sum: "$total_amount" },
        count: { $sum: "$quantity" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  return rows.map((r) => ({
    name: r._id,
    revenue: round2(r.revenue),
    count: r.count,
  }));
}

async function aggregateTopCustomers(start, end) {
  const rows = await Invoice.aggregate([
    {
      $match: {
        billing_date: { $gte: start, $lte: end },
        payment_status: { $ne: "void" },
        customer_id: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$customer_id",
        total_spend: { $sum: "$totals.grand_total" },
        visits: { $sum: 1 },
        last_visit: { $max: "$billing_date" },
        name: { $last: "$customer_name" },
        phone: { $last: "$customer_phone" },
      },
    },
    { $sort: { total_spend: -1 } },
    { $limit: 10 },
  ]);

  return rows.map((r) => ({
    customer_id: r._id,
    name: r.name || "Customer",
    phone: r.phone || "—",
    total_spend: round2(r.total_spend),
    visits: r.visits,
    last_visit: r.last_visit,
  }));
}

async function aggregateRetention(start, end) {
  const now = new Date();
  const inactiveCutoff = new Date(now);
  inactiveCutoff.setDate(inactiveCutoff.getDate() - 90);
  const atRiskCutoff = new Date(now);
  atRiskCutoff.setDate(atRiskCutoff.getDate() - 30);

  const [totalCustomers, newCustomers, repeatRows, inactiveCount, atRiskCount] =
    await Promise.all([
      Customer.countDocuments({}),
      Customer.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Invoice.aggregate([
        { $match: { payment_status: { $ne: "void" }, customer_id: { $ne: null } } },
        { $group: { _id: "$customer_id", visits: { $sum: 1 } } },
        { $match: { visits: { $gt: 1 } } },
        { $count: "count" },
      ]),
      Invoice.aggregate([
        { $match: { payment_status: { $ne: "void" }, customer_id: { $ne: null } } },
        { $group: { _id: "$customer_id", last_visit: { $max: "$billing_date" } } },
        { $match: { last_visit: { $lt: inactiveCutoff } } },
        { $count: "count" },
      ]),
      Invoice.aggregate([
        { $match: { payment_status: { $ne: "void" }, customer_id: { $ne: null } } },
        { $group: { _id: "$customer_id", last_visit: { $max: "$billing_date" } } },
        {
          $match: {
            last_visit: { $gte: inactiveCutoff, $lt: atRiskCutoff },
          },
        },
        { $count: "count" },
      ]),
    ]);

  const repeatCustomers = repeatRows[0]?.count || 0;
  const repeatRate = totalCustomers
    ? round2((repeatCustomers / totalCustomers) * 100)
    : 0;

  return {
    total_customers: totalCustomers,
    new_this_period: newCustomers,
    repeat_customers: repeatCustomers,
    repeat_rate: repeatRate,
    inactive_90_days: inactiveCount[0]?.count || 0,
    at_risk_30_days: atRiskCount[0]?.count || 0,
  };
}

async function aggregateInventorySnapshot() {
  const products = await ProductMaster.find({ is_active: true }).select(
    "name sku current_stock reorder_level purchase_price sale_price unit"
  );

  let totalStockUnits = 0;
  let totalPurchaseValue = 0;
  let totalSaleValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const reorderAlerts = [];

  for (const product of products) {
    const stock = Number(product.current_stock ?? 0);
    const reorder = Number(product.reorder_level ?? 0);
    const cost = Number(product.purchase_price ?? 0);
    const sale = Number(product.sale_price ?? 0);

    totalStockUnits += stock;
    totalPurchaseValue += stock * cost;
    totalSaleValue += stock * sale;

    const isOut = stock === 0;
    const isLow = stock <= reorder;

    if (isOut) outOfStockCount++;
    else if (isLow) lowStockCount++;

    if (isLow) {
      reorderAlerts.push({
        id: product._id,
        name: product.name,
        sku: product.sku,
        current_stock: stock,
        reorder_level: reorder,
        status: isOut ? "out_of_stock" : "low_stock",
      });
    }
  }

  reorderAlerts.sort((a, b) => {
    if (a.status === "out_of_stock" && b.status !== "out_of_stock") return -1;
    if (a.status !== "out_of_stock" && b.status === "out_of_stock") return 1;
    return a.current_stock - b.current_stock;
  });

  return {
    total_products: products.length,
    total_stock_units: totalStockUnits,
    low_stock_count: lowStockCount,
    out_of_stock_count: outOfStockCount,
    stock_value_purchase: round2(totalPurchaseValue),
    stock_value_sale: round2(totalSaleValue),
    reorder_alerts: reorderAlerts.slice(0, 8),
  };
}

async function aggregatePackagesSnapshot(start, end) {
  const now = new Date();
  const expiringSoonCutoff = new Date(now);
  expiringSoonCutoff.setDate(expiringSoonCutoff.getDate() + 30);

  const [activeCount, expiringSoon, exhaustedCount, packageRevenue] = await Promise.all([
    CustomerPackage.countDocuments({ status: "active" }),
    CustomerPackage.countDocuments({
      status: "active",
      expiry_date: { $gte: now, $lte: expiringSoonCutoff },
    }),
    CustomerPackage.countDocuments({ status: "exhausted" }),
    InvoiceLineItem.aggregate([
      {
        $lookup: {
          from: "invoices",
          localField: "invoice_id",
          foreignField: "_id",
          as: "invoice",
        },
      },
      { $unwind: "$invoice" },
      {
        $match: {
          item_type: "package",
          "invoice.billing_date": { $gte: start, $lte: end },
          "invoice.payment_status": { $ne: "void" },
        },
      },
      { $group: { _id: null, total: { $sum: "$total_amount" } } },
    ]),
  ]);

  return {
    active_count: activeCount,
    expiring_soon: expiringSoon,
    exhausted_count: exhaustedCount,
    revenue_this_period: round2(packageRevenue[0]?.total || 0),
  };
}

async function aggregateAttendanceSnapshot(year, month) {
  const start = startOfMonth(year, month);
  const end = endOfMonth(year, month);
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const staffProfiles = await StaffProfile.find({ is_active: true })
    .populate("user_id", "name phone")
    .lean();

  const AttendanceModel = Attendance;
  const records = await AttendanceModel.find({
    date: { $gte: start, $lte: end },
  }).lean();

  const byStaff = new Map();
  for (const rec of records) {
    const sid = String(rec.staff_id);
    if (!byStaff.has(sid)) byStaff.set(sid, []);
    byStaff.get(sid).push(rec);
  }

  const staffRows = staffProfiles.map((staff) => {
    const sid = String(staff._id);
    const staffRecords = byStaff.get(sid) || [];
    let present = 0;
    let late = 0;
    let absent = 0;

    for (const rec of staffRecords) {
      if (rec.status === "present") present++;
      else if (rec.status === "late") late++;
      else if (rec.status === "absent") absent++;
    }

    const payable = present + late + staffRecords.filter((r) => r.status === "half_day").length * 0.5;
    const attendanceRate = totalDays ? round2(((present + late) / totalDays) * 100) : 0;

    return {
      staff_id: staff._id,
      name: staff.user_id?.name || staff.designation || "Staff",
      designation: staff.designation,
      present,
      late,
      absent,
      payable_days: round2(payable),
      attendance_rate: attendanceRate,
    };
  });

  staffRows.sort((a, b) => b.attendance_rate - a.attendance_rate);

  const avgRate = staffRows.length
    ? round2(staffRows.reduce((sum, s) => sum + s.attendance_rate, 0) / staffRows.length)
    : 0;

  return {
    staff_count: staffRows.length,
    avg_attendance_rate: avgRate,
    total_payable_days: round2(staffRows.reduce((sum, s) => sum + s.payable_days, 0)),
    top_performers: staffRows.slice(0, 5),
    needs_attention: [...staffRows].sort((a, b) => a.attendance_rate - b.attendance_rate).slice(0, 5),
  };
}

function buildInsights({
  current,
  previous,
  bookings,
  retention,
  inventory,
  packages,
  attendance,
}) {
  const insights = [];

  const revenueTrend = calcTrend(current.revenue, previous.revenue);
  if (revenueTrend.direction === "up" && revenueTrend.percent >= 5) {
    insights.push({
      type: "success",
      title: "Revenue is climbing",
      body: `Revenue is up ${revenueTrend.percent}% vs last month at ₹${current.revenue.toLocaleString("en-IN")}.`,
    });
  } else if (revenueTrend.direction === "down" && revenueTrend.percent >= 5) {
    insights.push({
      type: "warning",
      title: "Revenue dipped this month",
      body: `Revenue fell ${revenueTrend.percent}% vs last month. Review promotions and stylist utilization.`,
    });
  }

  if (bookings.no_show_rate >= 8) {
    insights.push({
      type: "warning",
      title: "High no-show rate",
      body: `${bookings.no_show_rate}% of bookings were no-shows. Consider deposit reminders or WhatsApp confirmations.`,
    });
  }

  if (retention.inactive_90_days > 0) {
    insights.push({
      type: "info",
      title: "Win-back opportunity",
      body: `${retention.inactive_90_days} customers haven't visited in 90+ days. A re-engagement campaign could recover revenue.`,
    });
  }

  if (inventory.out_of_stock_count > 0) {
    insights.push({
      type: "warning",
      title: "Stock-outs hurting retail",
      body: `${inventory.out_of_stock_count} products are out of stock — retail upsell revenue may be leaking.`,
    });
  }

  if (packages.expiring_soon > 0) {
    insights.push({
      type: "info",
      title: "Packages expiring soon",
      body: `${packages.expiring_soon} active packages expire within 30 days. Nudge clients to redeem credits.`,
    });
  }

  if (attendance.avg_attendance_rate < 75 && attendance.staff_count > 0) {
    insights.push({
      type: "warning",
      title: "Attendance below target",
      body: `Average staff attendance is ${attendance.avg_attendance_rate}% this month. Payroll and scheduling may be impacted.`,
    });
  }

  if (current.outstanding > 0) {
    insights.push({
      type: "info",
      title: "Outstanding collections",
      body: `₹${current.outstanding.toLocaleString("en-IN")} is still due on invoices this period.`,
    });
  }

  if (!insights.length) {
    insights.push({
      type: "success",
      title: "Salon is running smoothly",
      body: "No critical alerts this period. Keep monitoring revenue and retention trends.",
    });
  }

  return insights.slice(0, 6);
}

function buildKpis(current, previous, bookings, retention) {
  return [
    {
      key: "revenue",
      label: "Total Revenue",
      value: current.revenue,
      period: "This month",
      tone: "primary",
      format: "currency",
      icon: "sales",
      trend: calcTrend(current.revenue, previous.revenue),
      sparkline: [],
    },
    {
      key: "avg_ticket",
      label: "Avg Ticket Size",
      value: current.avg_ticket,
      period: "Per invoice",
      tone: "info",
      format: "currency",
      icon: "earnings",
      trend: calcTrend(current.avg_ticket, previous.avg_ticket),
      sparkline: [],
    },
    {
      key: "bookings",
      label: "Total Bookings",
      value: bookings.total,
      period: "This month",
      tone: "success",
      format: "number",
      icon: "bookings",
      trend: calcTrend(bookings.total, previous.booking_count || 0),
      sparkline: [],
    },
    {
      key: "repeat_rate",
      label: "Repeat Client Rate",
      value: retention.repeat_rate,
      period: "All time",
      tone: "warning",
      format: "percent",
      icon: "customers",
      trend: { percent: 0, direction: "neutral", label: "Lifetime metric" },
      sparkline: [],
    },
    {
      key: "gst",
      label: "GST Collected",
      value: current.gst,
      period: "This month",
      tone: "neutral",
      format: "currency",
      icon: "inventory",
      trend: calcTrend(current.gst, previous.gst),
      sparkline: [],
    },
    {
      key: "no_show",
      label: "No-Show Rate",
      value: bookings.no_show_rate,
      period: "This month",
      tone: "danger",
      format: "percent",
      icon: "upcoming",
      trend: calcTrend(bookings.no_show_rate, previous.no_show_rate || 0, {
        invert: true,
        label: "Lower is better",
      }),
      sparkline: [],
    },
  ];
}

export async function getOwnerReports({ month, year } = {}) {
  const now = new Date();
  const reportYear = Number(year) || now.getUTCFullYear();
  const reportMonth = Number(month) || now.getUTCMonth() + 1;

  const start = startOfMonth(reportYear, reportMonth);
  const end = endOfMonth(reportYear, reportMonth);
  const prev = previousMonth(reportYear, reportMonth);
  const prevStart = startOfMonth(prev.year, prev.month);
  const prevEnd = endOfMonth(prev.year, prev.month);

  const [
    currentInvoices,
    previousInvoices,
    revenueTrend,
    paymentModes,
    revenueByCategory,
    bookings,
    bookingTrend,
    peakHours,
    weekdayLoad,
    staffLeaderboard,
    topServices,
    topCustomers,
    retention,
    inventory,
    packages,
    attendance,
    prevBookings,
  ] = await Promise.all([
    aggregateInvoiceSummary(start, end),
    aggregateInvoiceSummary(prevStart, prevEnd),
    aggregateRevenueTrend(start, end, reportYear, reportMonth),
    aggregatePaymentModes(start, end),
    aggregateRevenueByCategory(start, end),
    aggregateBookingStats(start, end),
    aggregateBookingTrend(start, end, reportYear, reportMonth),
    aggregatePeakHours(start, end),
    aggregateWeekdayLoad(start, end),
    aggregateStaffLeaderboard(start, end),
    aggregateTopServices(start, end),
    aggregateTopCustomers(start, end),
    aggregateRetention(start, end),
    aggregateInventorySnapshot(),
    aggregatePackagesSnapshot(start, end),
    aggregateAttendanceSnapshot(reportYear, reportMonth),
    aggregateBookingStats(prevStart, prevEnd),
  ]);

  const previous = {
    ...previousInvoices,
    booking_count: prevBookings.total,
    no_show_rate: prevBookings.no_show_rate,
  };

  const insights = buildInsights({
    current: currentInvoices,
    previous: previousInvoices,
    bookings,
    retention,
    inventory,
    packages,
    attendance,
  });

  const kpis = buildKpis(currentInvoices, previousInvoices, bookings, retention);

  kpis[0].sparkline = revenueTrend.values.slice(-7);
  kpis[2].sparkline = bookingTrend.values.slice(-7);

  return {
    period: {
      month: reportMonth,
      year: reportYear,
      label: formatPeriodLabel(reportMonth, reportYear),
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    },
    executive: {
      revenue: {
        value: currentInvoices.revenue,
        previous: previousInvoices.revenue,
        trend: calcTrend(currentInvoices.revenue, previousInvoices.revenue),
      },
      invoices: {
        count: currentInvoices.invoice_count,
        previous: previousInvoices.invoice_count,
        trend: calcTrend(currentInvoices.invoice_count, previousInvoices.invoice_count),
      },
      avg_ticket: {
        value: currentInvoices.avg_ticket,
        previous: previousInvoices.avg_ticket,
        trend: calcTrend(currentInvoices.avg_ticket, previousInvoices.avg_ticket),
      },
      outstanding: currentInvoices.outstanding,
      gst_collected: currentInvoices.gst,
      discount_given: currentInvoices.discount,
      customers_served: currentInvoices.customers_served,
    },
    kpis,
    charts: {
      revenue_trend: revenueTrend,
      payment_mode_split: paymentModes,
      revenue_by_category: revenueByCategory,
      booking_status: bookings.status_breakdown,
      booking_trend: bookingTrend,
      peak_hours: peakHours,
      weekday_load: weekdayLoad,
    },
    staff_leaderboard: staffLeaderboard,
    top_services: topServices,
    top_customers: topCustomers,
    retention,
    attendance_snapshot: attendance,
    inventory_snapshot: inventory,
    packages_snapshot: packages,
    insights,
    generated_at: new Date().toISOString(),
  };
}
