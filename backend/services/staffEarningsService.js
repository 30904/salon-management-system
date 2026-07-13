import CommissionEntry from "../models/CommissionEntry.js";
import StaffProfile from "../models/StaffProfile.js";
import { AppError } from "../utils/AppError.js";

function parsePeriod(query = {}) {
  const now = new Date();
  const month = Number(query.month) || now.getMonth() + 1;
  const year = Number(query.year) || now.getFullYear();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("month must be between 1 and 12", 400);
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("year must be a valid four-digit year", 400);
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);

  return { month, year, periodStart, periodEnd };
}

export async function getStaffProfileByUserId(userId) {
  return StaffProfile.findOne({ user_id: userId, is_active: true }).populate(
    "user_id",
    "name phone email"
  );
}

export async function getMyEarnings(userId, query = {}) {
  const profile = await getStaffProfileByUserId(userId);
  const { month, year, periodStart, periodEnd } = parsePeriod(query);

  if (!profile) {
    return {
      staff: null,
      period: { month, year },
      summary: {
        entry_count: 0,
        commission_total: 0,
        sales_total: 0,
        base_salary: 0,
      },
      entries: [],
    };
  }

  const entries = await CommissionEntry.find({
    staff_id: profile._id,
    calculated_at: { $gte: periodStart, $lt: periodEnd },
  })
    .sort({ calculated_at: -1 })
    .lean();

  const commissionTotal = entries.reduce(
    (sum, entry) => sum + Number(entry.commission_amount || 0),
    0
  );
  const salesTotal = entries.reduce(
    (sum, entry) => sum + Number(entry.line_amount || 0),
    0
  );

  return {
    staff: profile.toSafeObject(),
    period: { month, year },
    summary: {
      entry_count: entries.length,
      commission_total: commissionTotal,
      sales_total: salesTotal,
      base_salary: profile.base_salary,
    },
    entries: entries.map((entry) => ({
      id: entry._id,
      staff_id: entry.staff_id,
      invoice_line_item_id: entry.invoice_line_item_id,
      commission_slab_id: entry.commission_slab_id,
      slab_type: entry.slab_type,
      commission_amount: entry.commission_amount,
      status: entry.status,
      calculated_at: entry.calculated_at,
      payroll_run_id: entry.payroll_run_id,
      service_label: entry.service_label,
      invoice_reference: entry.invoice_reference,
      line_amount: entry.line_amount,
      calculation_details_json: entry.calculation_details_json,
      created_at: entry.createdAt,
    })),
  };
}
