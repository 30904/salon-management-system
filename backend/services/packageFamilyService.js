/**
 * Family linking for amount_wallet CustomerPackages (Feature 3).
 */
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import CustomerPackage from "../models/CustomerPackage.js";
import {
  MAX_WALLET_FAMILY_MEMBERS,
  PACKAGE_TYPE_AMOUNT_WALLET,
} from "../constants/packageConstants.js";
import { AppError } from "../utils/AppError.js";

function assertValidId(id, label) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

async function loadWalletPackage(customerPackageId) {
  assertValidId(customerPackageId, "customer package id");

  const customerPackage = await CustomerPackage.findById(customerPackageId).populate(
    "package_master_id",
    "name type validity_days price wallet_value credit_count"
  );

  if (!customerPackage) {
    throw new AppError("Customer package not found", 404);
  }

  const master = customerPackage.package_master_id;
  const masterType =
    master && typeof master === "object" ? master.type : null;

  if (masterType !== PACKAGE_TYPE_AMOUNT_WALLET) {
    throw new AppError(
      "Family members can only be linked to amount_wallet packages",
      400
    );
  }

  return customerPackage;
}

/**
 * Add a family member who may redeem this wallet (not the buyer).
 */
export async function addFamilyMember(customerPackageId, customerId) {
  assertValidId(customerId, "customer id");

  const customerPackage = await loadWalletPackage(customerPackageId);
  const member = await Customer.findById(customerId).select("_id name phone");

  if (!member) {
    throw new AppError("Customer not found", 404);
  }

  if (String(customerPackage.customer_id) === String(member._id)) {
    throw new AppError("Buyer is already the wallet owner — do not add as family", 400);
  }

  const linked = (customerPackage.linked_family_customer_ids || []).map(String);
  if (linked.includes(String(member._id))) {
    throw new AppError("Customer is already a family member on this wallet", 400);
  }

  if (linked.length >= MAX_WALLET_FAMILY_MEMBERS) {
    throw new AppError(
      `Maximum ${MAX_WALLET_FAMILY_MEMBERS} family members allowed on a wallet`,
      400
    );
  }

  customerPackage.linked_family_customer_ids.push(member._id);
  await customerPackage.save();

  await customerPackage.populate("customer_id", "name phone email");
  await customerPackage.populate(
    "package_master_id",
    "name type validity_days price wallet_value included_services credit_count"
  );
  await customerPackage.populate(
    "linked_family_customer_ids",
    "name phone email"
  );

  return customerPackage;
}

/**
 * Remove a family member. Allowed even after partial wallet use (stops future redeem only).
 */
export async function removeFamilyMember(customerPackageId, customerId) {
  assertValidId(customerId, "customer id");

  const customerPackage = await loadWalletPackage(customerPackageId);
  const before = (customerPackage.linked_family_customer_ids || []).length;

  customerPackage.linked_family_customer_ids = (
    customerPackage.linked_family_customer_ids || []
  ).filter((id) => String(id) !== String(customerId));

  if (customerPackage.linked_family_customer_ids.length === before) {
    throw new AppError("Customer is not a family member on this wallet", 404);
  }

  await customerPackage.save();

  await customerPackage.populate("customer_id", "name phone email");
  await customerPackage.populate(
    "package_master_id",
    "name type validity_days price wallet_value included_services credit_count"
  );
  await customerPackage.populate(
    "linked_family_customer_ids",
    "name phone email"
  );

  return customerPackage;
}

export default {
  addFamilyMember,
  removeFamilyMember,
};
