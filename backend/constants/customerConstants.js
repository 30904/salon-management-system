/**
 * Feature 2 — CRM customer list pagination.
 * After ~3000 client seed: never raise list max to 3000; page instead.
 * Mirrors named-constant pattern (MAX_WALLET_FAMILY_MEMBERS / REDO_WINDOW_DAYS).
 */

/** Default page size for GET /customers and CrmHome first paint. */
export const CUSTOMER_LIST_PAGE_SIZE = 25;

/** Hard cap for pageSize query param. Do not raise to seed size. */
export const CUSTOMER_LIST_MAX_PAGE_SIZE = 50;

/**
 * Clamp a requested pageSize to [1, CUSTOMER_LIST_MAX_PAGE_SIZE].
 * Invalid / missing → CUSTOMER_LIST_PAGE_SIZE.
 */
export function resolveCustomerListPageSize(pageSize) {
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n < 1) {
    return CUSTOMER_LIST_PAGE_SIZE;
  }
  return Math.min(Math.floor(n), CUSTOMER_LIST_MAX_PAGE_SIZE);
}

export default {
  CUSTOMER_LIST_PAGE_SIZE,
  CUSTOMER_LIST_MAX_PAGE_SIZE,
  resolveCustomerListPageSize,
};
