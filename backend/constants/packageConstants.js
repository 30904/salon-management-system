/**
 * Feature 3 — Family amount-wallet package constants.
 * Client-tunable numbers live here only (MD open point 3.6).
 */

/** Max family members linked to one amount_wallet CustomerPackage (buyer not counted). */
export const MAX_WALLET_FAMILY_MEMBERS = 6;

/**
 * Client wallet catalog (Aug 2026): Buy ₹X GET ₹Y = ₹Z usable balance.
 * validity_days: null = never expires (client confirmed).
 * Seed via npm run seed:client-wallet-packages.
 */
export const CLIENT_WALLET_PACKAGE_TIERS = Object.freeze([
  {
    name: "Bronze Package",
    price: 5000,
    wallet_value: 6000,
    validity_days: null,
  },
  {
    name: "Silver Package",
    price: 10000,
    wallet_value: 13000,
    validity_days: null,
  },
  {
    name: "Gold Package",
    price: 20000,
    wallet_value: 26000,
    validity_days: null,
  },
  {
    name: "Platinum Package",
    price: 30000,
    wallet_value: 40000,
    validity_days: null,
  },
  {
    name: "Diamond Package",
    price: 50000,
    wallet_value: 70000,
    validity_days: null,
  },
]);

export const PACKAGE_TYPE_AMOUNT_WALLET = "amount_wallet";

export default {
  MAX_WALLET_FAMILY_MEMBERS,
  CLIENT_WALLET_PACKAGE_TIERS,
  PACKAGE_TYPE_AMOUNT_WALLET,
};
