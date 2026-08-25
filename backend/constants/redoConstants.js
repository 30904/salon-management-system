/**
 * Feature 4 — Service redo / rework constants.
 *
 * Tracker row 3 Gate: coded defaults are OK for build, but payroll product-cost
 * deduction must NOT go live until client confirms open points 4.7.
 * Flip REDO_PAYROLL_DEDUCTION_ENABLED only after that sign-off (tracker row 25).
 *
 * @see docs/Feature-4-Redo-Client-Open-Points.md
 * @see IMPLEMENTATION_GUIDE_PENDING_CHANGES.md §4.7
 */

/** Days after original invoice.billing_date during which a redo may be requested (4.7c). */
export const REDO_WINDOW_DAYS = 7;

/**
 * GATE — payroll paycheck cut.
 * false = runPayrollForMonth must NOT subtract redo product cost (even if completed
 * RedoRequests exist). Set true only after client confirms 4.7(a)–(e).
 *
 * Optional env override for MD 4.8 / CI tests only:
 *   REDO_PAYROLL_DEDUCTION_ENABLED=true npm run test:payroll-redo-month
 * Do not set this in production until tracker row 25 sign-off.
 */
function readPayrollDeductionGate() {
  const fromEnv = String(process.env.REDO_PAYROLL_DEDUCTION_ENABLED || "").toLowerCase();
  if (fromEnv === "true") return true;
  if (fromEnv === "false") return false;
  return false;
}

export const REDO_PAYROLL_DEDUCTION_ENABLED = readPayrollDeductionGate();

/**
 * Who is charged when a completed redo has product cost (4.7a).
 * Coded default: staff who performs the redo (`redo_staff_id`), which defaults to
 * the original stylist but is editable at request time.
 */
export const REDO_DEDUCTION_STAFF_FIELD = "redo_staff_id";

/**
 * Cost basis for product used on redo (4.7b).
 * Snapshot ProductMaster.purchase_price at complete time — not sale_price.
 */
export const REDO_COST_BASIS_FIELD = "purchase_price";

/** 4.7d — empty productsUsed → total_product_cost 0 → no salary cut; ₹0 invoice still created. */
export const REDO_SERVICE_ONLY_ALLOWS_ZERO_COST = true;

/** 4.7e — reject a second non-rejected RedoRequest on the same original line item. */
export const REDO_ONE_PER_ORIGINAL_LINE = true;

/** Safe public config for GET /redo/config (FE must not duplicate window days). */
export function getRedoPublicConfig() {
  return {
    redo_window_days: REDO_WINDOW_DAYS,
    payroll_deduction_enabled: REDO_PAYROLL_DEDUCTION_ENABLED,
    deduction_staff_field: REDO_DEDUCTION_STAFF_FIELD,
    cost_basis_field: REDO_COST_BASIS_FIELD,
    service_only_allows_zero_cost: REDO_SERVICE_ONLY_ALLOWS_ZERO_COST,
    one_redo_per_original_line: REDO_ONE_PER_ORIGINAL_LINE,
  };
}

/** Used by payrollService when Feature 4 payroll row is wired. */
export function isRedoPayrollDeductionEnabled() {
  return REDO_PAYROLL_DEDUCTION_ENABLED === true;
}

export default {
  REDO_WINDOW_DAYS,
  REDO_PAYROLL_DEDUCTION_ENABLED,
  REDO_DEDUCTION_STAFF_FIELD,
  REDO_COST_BASIS_FIELD,
  REDO_SERVICE_ONLY_ALLOWS_ZERO_COST,
  REDO_ONE_PER_ORIGINAL_LINE,
  getRedoPublicConfig,
  isRedoPayrollDeductionEnabled,
};

