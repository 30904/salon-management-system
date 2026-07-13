import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import "../models/Branch.js";
import Customer from "../models/Customer.js";
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage from "../models/CustomerPackage.js";
import {
  computePackagePricing,
  validateAndResolveRedemption,
  batchValidatePackageRedemptions,
} from "../services/packageRedemptionService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting packageRedemptionService.js tests...\n");

  // ─── 1. Unit test: computePackagePricing for prepaid_bundle ────────────────
  console.log("[test] 1. computePackagePricing() — prepaid_bundle → full cover (₹0 to customer)...");
  const mockPrepaidPkg = { type: "prepaid_bundle" };
  const mockPrepaidMaster = { type: "prepaid_bundle", discount_logic_json: {} };
  const lineItem = { quantity: 1, unit_price: 2000, discount_amount: 0, tax_amount: 360 };

  const prepaidPricing = computePackagePricing(mockPrepaidPkg, mockPrepaidMaster, lineItem);
  console.log(`       pricing_mode         : ${prepaidPricing.pricing_mode}`);
  console.log(`       package_discount_amt : ₹${prepaidPricing.package_discount_amount}`);
  console.log(`       adjusted_total_amount: ₹${prepaidPricing.adjusted_total_amount}`);
  console.log(`       package_covers_tax   : ${prepaidPricing.package_covers_tax}`);
  if (prepaidPricing.pricing_mode !== "full_cover") throw new Error("Expected full_cover for prepaid_bundle");
  if (prepaidPricing.adjusted_total_amount !== 0) throw new Error(`Expected ₹0 total, got ${prepaidPricing.adjusted_total_amount}`);
  if (!prepaidPricing.package_covers_tax) throw new Error("Expected package_covers_tax=true for prepaid_bundle");
  console.log("       -> PASSED\n");

  // ─── 2. Unit test: computePackagePricing for membership (20% discount) ─────
  console.log("[test] 2. computePackagePricing() — membership 20% → discount_pct applied...");
  const mockMembershipMaster = { type: "membership", discount_logic_json: { mode: "percentage", value: 20 } };
  const membershipItem = { quantity: 1, unit_price: 2000, discount_amount: 0, tax_amount: 360 };

  const membershipPricing = computePackagePricing({}, mockMembershipMaster, membershipItem);
  console.log(`       pricing_mode         : ${membershipPricing.pricing_mode}`);
  console.log(`       membership_discount% : ${membershipPricing.membership_discount_pct}%`);
  console.log(`       package_discount_amt : ₹${membershipPricing.package_discount_amount}`);
  console.log(`       adjusted_total_amount: ₹${membershipPricing.adjusted_total_amount}`);
  // 20% of ₹2000 = ₹400 discount; customer pays ₹1600 + ₹360 tax = ₹1960
  if (membershipPricing.pricing_mode !== "discount_pct") throw new Error("Expected discount_pct");
  if (membershipPricing.package_discount_amount !== 400) throw new Error(`Expected ₹400 discount, got ${membershipPricing.package_discount_amount}`);
  if (membershipPricing.adjusted_total_amount !== 1960) throw new Error(`Expected ₹1960 total, got ${membershipPricing.adjusted_total_amount}`);
  console.log("       -> PASSED\n");

  // ─── 3. Unit test: computePackagePricing for membership (flat ₹500 discount) ─
  console.log("[test] 3. computePackagePricing() — membership flat ₹500 discount...");
  const mockFlatMaster = { type: "membership", discount_logic_json: { mode: "flat", value: 500 } };
  const flatItem = { quantity: 1, unit_price: 1800, discount_amount: 0, tax_amount: 324 };

  const flatPricing = computePackagePricing({}, mockFlatMaster, flatItem);
  console.log(`       pricing_mode            : ${flatPricing.pricing_mode}`);
  console.log(`       membership_flat_discount: ₹${flatPricing.membership_flat_discount}`);
  console.log(`       adjusted_total_amount   : ₹${flatPricing.adjusted_total_amount}`);
  // ₹1800 - ₹500 = ₹1300 + ₹324 tax = ₹1624
  if (flatPricing.pricing_mode !== "flat_cover") throw new Error("Expected flat_cover");
  if (flatPricing.membership_flat_discount !== 500) throw new Error(`Expected ₹500 flat discount, got ${flatPricing.membership_flat_discount}`);
  if (flatPricing.adjusted_total_amount !== 1624) throw new Error(`Expected ₹1624 total, got ${flatPricing.adjusted_total_amount}`);
  console.log("       -> PASSED\n");

  // ─── DB Tests — setup real records ─────────────────────────────────────────
  console.log("[test] Setting up DB records for integration tests...");
  let customer = await Customer.findOne();
  if (!customer) customer = await Customer.create({ name: "Pkg Redeem Test Customer", phone: "9000000099" });

  // Clean + create test PackageMasters
  await PackageMaster.deleteMany({ name: { $in: ["Test Prepaid Bundle", "Test Membership 20%"] } });
  const prepaidMaster = await PackageMaster.create({
    name: "Test Prepaid Bundle", type: "prepaid_bundle", validity_days: 30, price: 3000, credit_count: 5,
  });
  const membershipMaster = await PackageMaster.create({
    name: "Test Membership 20%", type: "membership", validity_days: 30, price: 5000, credit_count: 0,
    discount_logic_json: { mode: "percentage", value: 20 },
  });

  // Clean + create CustomerPackages
  await CustomerPackage.deleteMany({ customer_id: customer._id, package_master_id: { $in: [prepaidMaster._id, membershipMaster._id] } });
  const activePrepaidPkg = await CustomerPackage.create({
    customer_id: customer._id, package_master_id: prepaidMaster._id,
    purchase_date: new Date(), expiry_date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    credits_remaining: 3, status: "active",
  });
  const activeMembershipPkg = await CustomerPackage.create({
    customer_id: customer._id, package_master_id: membershipMaster._id,
    purchase_date: new Date(), expiry_date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    credits_remaining: 0, status: "active",  // memberships use 0 credits (discount-based)
  });
  const expiredPkg = await CustomerPackage.create({
    customer_id: customer._id, package_master_id: prepaidMaster._id,
    purchase_date: new Date(Date.now() - 40 * 24 * 3600 * 1000),
    expiry_date: new Date(Date.now() - 5 * 24 * 3600 * 1000), // expired 5 days ago
    credits_remaining: 2, status: "active",
  });
  const exhaustedPkg = await CustomerPackage.create({
    customer_id: customer._id, package_master_id: prepaidMaster._id,
    purchase_date: new Date(), expiry_date: new Date(Date.now() + 10 * 24 * 3600 * 1000),
    credits_remaining: 0, status: "exhausted",
  });
  console.log("       Records created.\n");

  // ─── 4. validateAndResolveRedemption — active prepaid with 3 credits, redeem 1 ─
  console.log("[test] 4. validateAndResolveRedemption() — active prepaid, 3 credits, redeem 1...");
  const lineItem1 = { quantity: 1, unit_price: 2000, discount_amount: 0, tax_amount: 360 };
  const resolved1 = await validateAndResolveRedemption(activePrepaidPkg._id, customer._id, 1, lineItem1);
  console.log(`       Package type  : ${resolved1.packageMaster.type}`);
  console.log(`       Pricing mode  : ${resolved1.pricing.pricing_mode}`);
  console.log(`       Total for cust: ₹${resolved1.pricing.adjusted_total_amount}`);
  if (resolved1.pricing.pricing_mode !== "full_cover") throw new Error("Expected full_cover");
  if (resolved1.pricing.adjusted_total_amount !== 0) throw new Error("Expected ₹0 adjusted total");
  console.log("       -> PASSED\n");

  // ─── 5. validateAndResolveRedemption — expired package → 400 ──────────────
  console.log("[test] 5. validateAndResolveRedemption() — expired package → should throw 400...");
  let errExpired = null;
  try {
    await validateAndResolveRedemption(expiredPkg._id, customer._id, 1, lineItem1);
  } catch (err) { errExpired = err; }
  if (!errExpired || errExpired.statusCode !== 400) throw new Error(`Expected 400 for expired pkg, got: ${errExpired?.statusCode}`);
  console.log(`       Got 400: "${errExpired.message}"`);
  console.log("       -> PASSED\n");

  // ─── 6. validateAndResolveRedemption — exhausted package → 400 ────────────
  console.log("[test] 6. validateAndResolveRedemption() — exhausted package → should throw 400...");
  let errExhausted = null;
  try {
    await validateAndResolveRedemption(exhaustedPkg._id, customer._id, 1, lineItem1);
  } catch (err) { errExhausted = err; }
  if (!errExhausted || errExhausted.statusCode !== 400) throw new Error(`Expected 400 for exhausted pkg, got: ${errExhausted?.statusCode}`);
  console.log(`       Got 400: "${errExhausted.message}"`);
  console.log("       -> PASSED\n");

  // ─── 7. validateAndResolveRedemption — insufficient credits (request 5, have 3) ─
  console.log("[test] 7. validateAndResolveRedemption() — insufficient credits → should throw 400...");
  let errCredits = null;
  try {
    await validateAndResolveRedemption(activePrepaidPkg._id, customer._id, 5, lineItem1);
  } catch (err) { errCredits = err; }
  if (!errCredits || errCredits.statusCode !== 400) throw new Error(`Expected 400 for insufficient credits, got ${errCredits?.statusCode}`);
  console.log(`       Got 400: "${errCredits.message}"`);
  console.log("       -> PASSED\n");

  // ─── 8. validateAndResolveRedemption — wrong customer → 400 ──────────────
  console.log("[test] 8. validateAndResolveRedemption() — wrong customer_id → should throw 400...");
  let errOwnership = null;
  const fakeCustId = "000000000000000000000001";
  try {
    await validateAndResolveRedemption(activePrepaidPkg._id, fakeCustId, 1, lineItem1);
  } catch (err) { errOwnership = err; }
  if (!errOwnership || errOwnership.statusCode !== 400) throw new Error(`Expected 400 for wrong customer, got ${errOwnership?.statusCode}`);
  console.log(`       Got 400: "${errOwnership.message}"`);
  console.log("       -> PASSED\n");

  // ─── 9. batchValidatePackageRedemptions — multi-line over-redemption guard ─
  console.log("[test] 9. batchValidatePackageRedemptions() — 2 lines each redeem 2 credits (total 4, only have 3)...");
  const lineItems = [
    { package_redemption_id: activePrepaidPkg._id, quantity: 2, unit_price: 2000, discount_amount: 0, tax_amount: 360 },
    { package_redemption_id: activePrepaidPkg._id, quantity: 2, unit_price: 1500, discount_amount: 0, tax_amount: 270 },
  ];
  let errBatch = null;
  try {
    await batchValidatePackageRedemptions(lineItems, customer._id);
  } catch (err) { errBatch = err; }
  if (!errBatch || errBatch.statusCode !== 400) throw new Error(`Expected 400 for over-redemption, got ${errBatch?.statusCode}`);
  console.log(`       Got 400: "${errBatch.message}"`);
  console.log("       -> PASSED\n");

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  await CustomerPackage.deleteMany({ customer_id: customer._id, package_master_id: { $in: [prepaidMaster._id, membershipMaster._id] } });
  await PackageMaster.deleteMany({ name: { $in: ["Test Prepaid Bundle", "Test Membership 20%"] } });
  console.log("[test] Cleaned up test records.");
  console.log("\n[test] All packageRedemptionService.js tests passed! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test failed:", err.message || err);
  process.exit(1);
});
