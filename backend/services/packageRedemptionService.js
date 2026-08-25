import CustomerPackage from "../models/CustomerPackage.js";
import { PACKAGE_TYPE_AMOUNT_WALLET } from "../constants/packageConstants.js";
import { AppError } from "../utils/AppError.js";

/**
 * Pricing modes:
 *   "full_cover"    — prepaid_bundle: line → ₹0
 *   "discount_pct"  — membership % off
 *   "flat_cover"    — membership flat ₹ off
 *   "wallet_deduct" — amount_wallet: min(lineTotal, wallet_balance); remainder payable
 */
export const REDEMPTION_PRICING_MODES = [
  "full_cover",
  "discount_pct",
  "flat_cover",
  "wallet_deduct",
];

export function computePackagePricing(customerPkg, packageMaster, lineItem) {
  const quantity = Number(lineItem.quantity || 1);
  const unitPrice = Number(lineItem.unit_price || 0);
  const existingDiscount = Number(lineItem.discount_amount || 0);
  const taxAmount = Number(lineItem.tax_amount || 0);

  const preTaxLineValue = Math.max(0, unitPrice * quantity - existingDiscount);

  if (packageMaster.type === PACKAGE_TYPE_AMOUNT_WALLET) {
    const walletBalance = Number(customerPkg.wallet_balance || 0);
    const lineTotal = preTaxLineValue;
    const deduction = Math.min(lineTotal, walletBalance);
    const remainingCharge = Number((lineTotal - deduction).toFixed(2));

    return {
      pricing_mode: "wallet_deduct",
      original_unit_price: unitPrice,
      package_discount_amount: deduction,
      wallet_deduction_amount: deduction,
      adjusted_discount_amount: existingDiscount + deduction,
      adjusted_total_amount: remainingCharge,
      adjusted_unit_price: unitPrice,
      package_covers_tax: true,
      remaining_charge: remainingCharge,
      wallet_balance_before: walletBalance,
    };
  }

  if (packageMaster.type === "prepaid_bundle") {
    const packageDiscount = preTaxLineValue;
    const adjustedDiscount = existingDiscount + packageDiscount;

    return {
      pricing_mode: "full_cover",
      original_unit_price: unitPrice,
      package_discount_amount: packageDiscount,
      adjusted_discount_amount: adjustedDiscount,
      adjusted_total_amount: 0,
      adjusted_unit_price: unitPrice,
      package_covers_tax: true,
    };
  }

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
      const packageDiscount = Math.min(discountValue, preTaxLineValue);
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

  return {
    pricing_mode: "none",
    original_unit_price: unitPrice,
    package_discount_amount: 0,
    adjusted_discount_amount: existingDiscount,
    adjusted_total_amount: Math.max(
      0,
      unitPrice * quantity - existingDiscount + taxAmount
    ),
    adjusted_unit_price: unitPrice,
    package_covers_tax: false,
  };
}

function customerCanRedeemPackage(customerPkg, customerId) {
  if (!customerId) return true;
  if (String(customerPkg.customer_id) === String(customerId)) return true;
  const family = (customerPkg.linked_family_customer_ids || []).map(String);
  return family.includes(String(customerId));
}

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

  if (customerId && !customerCanRedeemPackage(customerPkg, customerId)) {
    throw new AppError(
      `Package (ID: ${packageId}) does not belong to this customer (buyer or family)`,
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
        wallet_balance: customerPkg.wallet_balance,
      }
    );
  }

  if (customerPkg.expiry_date && new Date(customerPkg.expiry_date) < new Date()) {
    throw new AppError(
      `Package '${customerPkg.package_master_id?.name || packageId}' expired on ${new Date(
        customerPkg.expiry_date
      ).toLocaleDateString("en-IN")}`,
      400,
      {
        package_id: customerPkg._id,
        expiry_date: customerPkg.expiry_date,
        status: customerPkg.status,
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

  if (packageMaster.type === PACKAGE_TYPE_AMOUNT_WALLET) {
    if (!(Number(customerPkg.wallet_balance) > 0)) {
      throw new AppError(
        `Wallet package '${packageMaster.name || packageId}' has no remaining balance`,
        400,
        {
          package_id: customerPkg._id,
          wallet_balance: customerPkg.wallet_balance,
        }
      );
    }
  } else if (customerPkg.credits_remaining < qty) {
    throw new AppError(
      `Package '${packageMaster.name || packageId}' has only ${
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

  const pricing = computePackagePricing(customerPkg, packageMaster, lineItem);

  return { customerPkg, packageMaster, pricing };
}

export async function batchValidatePackageRedemptions(lineItems, customerId) {
  const pkgQuantityMap = new Map();

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
      const representativeItem = lineItems.find(
        (item) => String(item.package_redemption_id) === pkgId
      );

      const resolved = await validateAndResolveRedemption(
        pkgId,
        customerId,
        totalQty,
        representativeItem
      );

      results.set(pkgId, resolved);
    })
  );

  return results;
}
