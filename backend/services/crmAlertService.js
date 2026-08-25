/**
 * CRM alert helpers (inactive-visit list).
 * Split from customerService.js to keep that file under ~300 lines.
 */
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import { resolveCustomerListPageSize } from "../constants/customerConstants.js";
import { AppError } from "../utils/AppError.js";

/** Default inactive threshold (days). Query param + UI override; client sign-off: docs/Feature-2-CRM-Client-Open-Points.md */
export const DEFAULT_INACTIVE_THRESHOLD_DAYS = 60;

function daysBetween(fromDate, toMs = Date.now()) {
  if (!fromDate) return null;
  const ms = toMs - new Date(fromDate).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Customers with no recent visit:
 * effective last visit = latest paid/partial Invoice.billing_date
 *   else imported_last_visit_date
 *   else null (never visited → inactive).
 * Sorted by days_since_last_visit desc (never-visited first).
 */
export async function getInactiveCustomers({
  thresholdDays = DEFAULT_INACTIVE_THRESHOLD_DAYS,
  search,
  page = 1,
  pageSize,
} = {}) {
  const days = Number(thresholdDays);
  if (!Number.isFinite(days) || days < 1) {
    throw new AppError("thresholdDays must be a positive number", 400);
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const latestInvoiceByCustomer = await Invoice.aggregate([
    { $match: { payment_status: { $in: ["paid", "partial"] } } },
    { $sort: { billing_date: -1 } },
    {
      $group: {
        _id: "$customer_id",
        lastVisit: { $first: "$billing_date" },
      },
    },
  ]);

  const lastVisitMap = new Map(
    latestInvoiceByCustomer.map((row) => [String(row._id), row.lastVisit])
  );

  const customers = await Customer.find({}).lean();
  const now = Date.now();

  const inactive = customers
    .map((customer) => {
      const realVisit = lastVisitMap.get(String(customer._id));
      const effectiveLastVisit =
        realVisit || customer.imported_last_visit_date || null;
      const daysSince = daysBetween(effectiveLastVisit, now);

      return {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        gender: customer.gender ?? null,
        notes: customer.notes ?? null,
        source: customer.source || "app",
        imported_last_visit_date: customer.imported_last_visit_date ?? null,
        effective_last_visit: effectiveLastVisit,
        days_since_last_visit: daysSince,
        threshold_days: days,
      };
    })
    .filter((customer) => {
      if (!customer.effective_last_visit) return true;
      return new Date(customer.effective_last_visit) < cutoff;
    })
    .sort(
      (a, b) =>
        (b.days_since_last_visit ?? Number.POSITIVE_INFINITY) -
        (a.days_since_last_visit ?? Number.POSITIVE_INFINITY)
    );

  let filtered = inactive;
  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    filtered = inactive.filter(
      (row) =>
        String(row.name || "")
          .toLowerCase()
          .includes(term) || String(row.phone || "").includes(term)
    );
  }

  const safePageSize = resolveCustomerListPageSize(pageSize);
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const skip = (safePage - 1) * safePageSize;
  const items = filtered.slice(skip, skip + safePageSize);

  return {
    items,
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
    hasMore: skip + items.length < filtered.length,
    threshold_days: days,
  };
}

export default {
  DEFAULT_INACTIVE_THRESHOLD_DAYS,
  getInactiveCustomers,
};
