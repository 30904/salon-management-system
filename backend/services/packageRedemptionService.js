import CustomerPackage from "../models/CustomerPackage.js";
import PackageMaster from "../models/PackageMaster.js";
import { AppError } from "../utils/AppError.js";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Pricing modes that determine how a package covers the line item cost:
 *
 *   "full_cover"   — prepaid_bundle: the package pays ₹0 from customer (line total → 0)
 *   "discount_pct" — membership: applies a discount % from discount_logic_json; customer pays remainder
 *   "flat_cover"   — membership with a fixed cash discount rather than percentage
 */
export const REDEMPTION_PRICING_MODES = ["full_cover", "discount_pct", "flat_cover"];

// ─── Core Helpers ─────────────────────────────────────────────────────────────

/**
 * Determine the pricing mode and compute adjusted totals for a line item
 * when a CustomerPackage is being redeemed.
 *
 * Rules:
 *   PackageMaster.type === "prepaid_bundle"
 *     → Full cover: line discount_amount = entire pre-tax line value → total_amount = tax only (or 0 if tax exempt)
 *
 *   PackageMaster.type === "membership"
 *     → Reads discount_logic_json for the discount rule:
 *         { mode: "percentage", value: 20 }    → 20% off pre-tax line value
 *         { mode: "flat", value: 500 }          → flat ₹500 off (capped at line value)
 *       If no discount_logic_json: falls back to full_cover (treat as full prepaid)
 *
 * @param {object} customerPkg   — Mongoose doc (CustomerPackage, not populated)
 * @param {object} packageMaster — Mongoose doc (PackageMaster)
 * @param {object} lineItem      — raw line item from request (unit_price, quantity, tax_amount, discount_amount)
 *
 * @returns {object} {
 *   pricing_mode,
 *   original_unit_price,
 *   package_discount_amount,   ← extra discount granted by package (NOT replacing user-set discount)
 *   adjusted_discount_amount,  ← original discount_amount + package_discount_amount
 *   adjusted_total_amount,     ← final customer-pays amount (pre-tax subtotal - total discount + tax)
 *   adjusted_unit_price,       ← display price on receipt (original, unchanged)
 *   package_covers_tax,        ← true only for full_cover prepaid_bundle
 * }
 */
export function computePackagePricing(customerPkg, packageMaster, lineItem) {
  const quantity = Number(lineItem.quantity || 1);
  const unitPrice = Number(lineItem.unit_price || 0);
  const existingDiscount = Number(lineItem.discount_amount || 0);
  const taxAmount = Number(lineItem.tax_amount || 0);

  const preTaxLineValue = Math.max(0, unitPrice * quantity - existingDiscount);

  // ── prepaid_bundle: full cover ────────────────────────────────────────────
  if (packageMaster.type === "prepaid_bundle") {
    // Customer pays ₹0 — the entire pre-tax + tax value is covered by the package
    const packageDiscount = preTaxLineValue; // covers everything before tax
    const adjustedDiscount = existingDiscount + packageDiscount;

    return {
      pricing_mode: "full_cover",
      original_unit_price: unitPrice,
      package_discount_amount: packageDiscount,
      adjusted_discount_amount: adjustedDiscount,
      adjusted_total_amount: 0,         // fully covered, no cash from customer
      adjusted_unit_price: unitPrice,   // show original price on receipt
      package_covers_tax: true,
    };
  }

  // ── membership: percentage or flat discount ───────────────────────────────
  if (packageMaster.type === "membership") {
    const logic = packageMaster.discount_logic_json || {};
    const discountMode = String(logic.mode || "percentage").toLowerCase();
    const discountValue = Number(logic.value || 0);

    if (discountMode === "percentage" && discountValue > 0) {
      const packageDiscount = Number(
        ((preTaxLineValue * discountValue) / 100).toFixed(2)
      );
      const adjustedDiscount = existingDiscount + packageDiscount;
      const adjustedTotal = Math.max(
        0,
        unitPrice * quantity - adjustedDiscount + taxAmount
      );

      return {
        pricing_mode: "discount_pct",
        original_unit_price: unitPrice,
        package_discount_amount: packageDiscount,
        adjusted_discount_amount: adjustedDiscount,
        adjusted_total_amount: Number(adjustedTotal.toFixed(2)),
        adjusted_unit_price: unitPrice,
        package_covers_tax: false,
        membership_discount_pct: discountValue,
      };
    }

    if (discountMode === "flat" && discountValue > 0) {
      const packageDiscount = Math.min(discountValue, preTaxLineValue); // cap at line value
      const adjustedDiscount = existingDiscount + packageDiscount;
      const adjustedTotal = Math.max(
        0,
        unitPrice * quantity - adjustedDiscount + taxAmount
      );

      return {
        pricing_mode: "flat_cover",
        original_unit_price: unitPrice,
        package_discount_amount: packageDiscount,
        adjusted_discount_amount: adjustedDiscount,
        adjusted_total_amount: Number(adjustedTotal.toFixed(2)),
        adjusted_unit_price: unitPrice,
        package_covers_tax: false,
        membership_flat_discount: packageDiscount,
      };
    }

    // Membership with no discount_logic_json → treat as full cover
    const packageDiscount = preTaxLineValue;
    return {
      pricing_mode: "full_cover",
      original_unit_price: unitPrice,
      package_discount_amount: packageDiscount,
      adjusted_discount_amount: existingDiscount + packageDiscount,
      adjusted_total_amount: 0,
      adjusted_unit_price: unitPrice,
      package_covers_tax: true,
    };
  }

  // Unknown type — no adjustment (defensive fallback)
  return {
    pricing_mode: "none",
    original_unit_price: unitPrice,
    package_discount_amount: 0,
    adjusted_discount_amount: existingDiscount,
    adjusted_total_amount: Math.max(0, unitPrice * quantity - existingDiscount + taxAmount),
    adjusted_unit_price: unitPrice,
    package_covers_tax: false,
  };
}

// ─── Pre-flight Validation ────────────────────────────────────────────────────

/**
 * Validate a CustomerPackage for redemption before entering the atomic transaction.
 * Returns the resolved { customerPkg, packageMaster, pricing } ready to merge into line item.
 *
 * Checks:
 *   - Package exists and belongs to the invoice's customer
 *   - Status === "active"
 *   - Not expired (expiry_date > now)
 *   - credits_remaining >= quantity
 *
 * @param {string|ObjectId} packageId   — CustomerPackage._id
 * @param {string|ObjectId} customerId  — must match pkg.customer_id
 * @param {number}          quantity    — units to redeem
 * @param {object}          lineItem    — raw line item (for pricing calculation)
 *
 * @returns {{ customerPkg, packageMaster, pricing }}
 */
export async function validateAndResolveRedemption(
  packageId,
  customerId,
  quantity,
  lineItem
) {
  const qty = Number(quantity || 1);

  const customerPkg = await CustomerPackage.findById(packageId).populate(
    "package_master_id"
  );

  if (!customerPkg) {
    throw new AppError(`Customer package (ID: ${packageId}) not found`, 404);
  }

  // Ownership check — package must belong to the invoiced customer
  if (customerId && String(customerPkg.customer_id) !== String(customerId)) {
    throw new AppError(
      `Package (ID: ${packageId}) does not belong to this customer`,
      400
    );
  }

  if (customerPkg.status !== "active") {
    throw new AppError(
      `Package '${customerPkg.package_master_id?.name || packageId}' is ${customerPkg.status} and cannot be redeemed`,
      400,
      {
        package_id: customerPkg._id,
        status: customerPkg.status,
        credits_remaining: customerPkg.credits_remaining,
      }
    );
  }

  // Expiry check
  if (customerPkg.expiry_date && new Date(customerPkg.expiry_date) < new Date()) {
    throw new AppError(
      `Package '${customerPkg.package_master_id?.name || packageId}' expired on ${
        new Date(customerPkg.expiry_date).toLocaleDateString("en-IN")
      }`,
      400,
      {
        package_id: customerPkg._id,
        expiry_date: customerPkg.expiry_date,
        status: customerPkg.status,
      }
    );
  }

  // Credits check
  if (customerPkg.credits_remaining < qty) {
    throw new AppError(
      `Package '${customerPkg.package_master_id?.name || packageId}' has only ${
        customerPkg.credits_remaining
      } credit(s) remaining. Requested: ${qty}`,
      400,
      {
        package_id: customerPkg._id,
        credits_remaining: customerPkg.credits_remaining,
        requested: qty,
      }
    );
  }

  const packageMaster = customerPkg.package_master_id;
  if (!packageMaster || !packageMaster._id) {
    throw new AppError(
      `Package master not found for customer package (ID: ${packageId})`,
      500
    );
  }

  // Compute the adjusted pricing for this line item
  const pricing = computePackagePricing(customerPkg, packageMaster, lineItem);

  return { customerPkg, packageMaster, pricing };
}

/**
 * Batch-validate all package-redeemed line items in a single pre-flight pass.
 * Returns a Map keyed by package_redemption_id (as string) → { customerPkg, packageMaster, pricing }.
 *
 * Also checks that the same package is not over-redeemed across multiple line items
 * (total quantity across lines must not exceed credits_remaining).
 *
 * @param {Array}           lineItems   — all line items from the invoice payload
 * @param {string|ObjectId} customerId  — invoice customer for ownership check
 */
export async function batchValidatePackageRedemptions(lineItems, customerId) {
  // Group by package_redemption_id to catch multi-line over-redemption
  const pkgQuantityMap = new Map(); // packageId → total qty requested

  for (const item of lineItems) {
    if (!item.package_redemption_id) continue;
    const pkgId = String(item.package_redemption_id);
    const qty = Number(item.quantity || 1);
    pkgQuantityMap.set(pkgId, (pkgQuantityMap.get(pkgId) || 0) + qty);
  }

  if (pkgQuantityMap.size === 0) return new Map();

  const results = new Map();

  await Promise.all(
    Array.from(pkgQuantityMap.entries()).map(async ([pkgId, totalQty]) => {
      // Use the first line item with this package_redemption_id for pricing computation
      const representativeItem = lineItems.find(
        (item) => String(item.package_redemption_id) === pkgId
      );

      const resolved = await validateAndResolveRedemption(
        pkgId,
        customerId,
        totalQty,          // validate against total across all lines
        representativeItem
      );

      results.set(pkgId, resolved);
    })
  );

  return results; // Map<packageId, { customerPkg, packageMaster, pricing }>
}
