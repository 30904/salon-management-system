/**
 * Payroll / target-commission tunables (salon rule).
 *
 * Staff (everyone except Raksha):
 *   Hit Target 1 only → TARGET_COMMISSION_RATE × Target 1.
 *   Hit Target 2 → TARGET_COMMISSION_RATE × Target 2 only (replaces T1 bonus).
 *
 * Salon manager bonus (Raksha only — not Front Manager / Mansi):
 *   Salon ≥ MANAGER_SALON_TARGET_1 → MANAGER_SALON_RATE_1 × salon sales.
 *   Salon ≥ MANAGER_SALON_TARGET_2 → MANAGER_SALON_RATE_2 × salon sales (replaces T1).
 */
export const TARGET_COMMISSION_RATE = 0.1;

/** Case-insensitive substring match on User.name for salon-sales bonus eligibility. */
export const SALON_BONUS_STAFF_NAME_MATCH = "raksha";

export const MANAGER_SALON_TARGET_1 = 900000;
export const MANAGER_SALON_TARGET_2 = 1200000;
export const MANAGER_SALON_RATE_1 = 0.01;
export const MANAGER_SALON_RATE_2 = 0.02;

export default {
  TARGET_COMMISSION_RATE,
  SALON_BONUS_STAFF_NAME_MATCH,
  MANAGER_SALON_TARGET_1,
  MANAGER_SALON_TARGET_2,
  MANAGER_SALON_RATE_1,
  MANAGER_SALON_RATE_2,
};
