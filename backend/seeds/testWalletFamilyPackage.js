/**
 * Feature 3 tracker rows 20–23 — wallet family redeem, overspend, remove family, void restore.
 *
 * Usage:
 *   npm run test:wallet-family-package
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/CommissionSlab.js";
import Customer from "../models/Customer.js";
import StaffProfile from "../models/StaffProfile.js";
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import { PACKAGE_TYPE_AMOUNT_WALLET } from "../constants/packageConstants.js";
import { addFamilyMember, removeFamilyMember } from "../services/packageFamilyService.js";
import { getActivePackagesByCustomerId } from "../services/customerService.js";
import { createInvoiceHandler, voidInvoiceHandler } from "../controllers/billingController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TEST_PKG_NAME = "Test Wallet Family 10K";
const PHONE_A = "9100000020";
const PHONE_B = "9100000021";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

async function callCreateInvoice(body) {
  const res = mockRes();
  let thrown = null;
  await createInvoiceHandler({ body, user: {} }, res, (err) => {
    thrown = err;
  });
  if (thrown) throw thrown;
  if (!res.body?.success) {
    throw new Error(res.body?.message || "createInvoiceHandler failed");
  }
  return res.body.data;
}

async function callVoidInvoice(invoiceId, reason = "Test void") {
  const res = mockRes();
  let thrown = null;
  await voidInvoiceHandler(
    { params: { id: invoiceId }, body: { reason }, user: {} },
    res,
    (err) => {
      thrown = err;
    }
  );
  if (thrown) throw thrown;
  if (!res.body?.success) {
    throw new Error(res.body?.message || "voidInvoiceHandler failed");
  }
  return res.body.data;
}

async function getStaffId() {
  let staff = await StaffProfile.findOne({ status: "active" }).select("_id");
  if (staff) return staff._id;

  const userCustomer = await Customer.create({
    name: "Wallet Test Staff",
    phone: "9100000022",
    email: "wallet-test-staff@test.local",
  });

  staff = await StaffProfile.create({
    user_id: userCustomer._id,
    designation: "Stylist",
    status: "active",
  });

  return staff._id;
}

async function cleanup() {
  const customers = await Customer.find({
    phone: { $in: [PHONE_A, PHONE_B, "9100000022"] },
  }).select("_id");
  const customerIds = customers.map((c) => c._id);

  if (customerIds.length > 0) {
    await StaffProfile.deleteMany({ user_id: { $in: customerIds } });
    const wallets = await CustomerPackage.find({ customer_id: { $in: customerIds } }).select(
      "_id"
    );
    const walletIds = wallets.map((w) => w._id);
    if (walletIds.length > 0) {
      await InvoiceLineItem.deleteMany({ package_redemption_id: { $in: walletIds } });
    }
    await CustomerPackage.deleteMany({ customer_id: { $in: customerIds } });
    await Invoice.deleteMany({ customer_id: { $in: customerIds } });
    await Customer.deleteMany({ _id: { $in: customerIds } });
  }

  await PackageMaster.deleteMany({ name: TEST_PKG_NAME });
}

async function setupWalletSale(customerA, walletValue = 10000) {
  let master = await PackageMaster.findOne({ name: TEST_PKG_NAME });
  if (!master) {
    master = await PackageMaster.create({
      name: TEST_PKG_NAME,
      type: PACKAGE_TYPE_AMOUNT_WALLET,
      validity_days: null,
      price: walletValue,
      wallet_value: walletValue,
      credit_count: 0,
      is_active: true,
    });
  }

  const customerPackage = await CustomerPackage.create({
    customer_id: customerA._id,
    package_master_id: master._id,
    purchase_date: new Date(),
    expiry_date: null,
    credits_remaining: 0,
    wallet_balance: walletValue,
    linked_family_customer_ids: [],
    status: "active",
    invoice_id: `WALLET-TEST-${Date.now()}`,
  });

  return { master, customerPackage };
}

async function main() {
  await connectDB();
  console.log("[test] Feature 3 — wallet family package (rows 20–23)\n");

  await cleanup();

  const customerA = await Customer.create({
    name: "Wallet Test Buyer A",
    phone: PHONE_A,
  });
  const customerB = await Customer.create({
    name: "Wallet Test Family B",
    phone: PHONE_B,
  });
  const staffId = await getStaffId();

  // ── Row 20: Sell wallet + family redeem ───────────────────────────────────
  console.log("[test] Row 20 — A buys ₹10000 wallet; add B; B redeems ₹450 service…");

  let { customerPackage: walletPkg } = await setupWalletSale(customerA, 10000);
  await addFamilyMember(walletPkg._id, customerB._id);

  const bPackagesBefore = await getActivePackagesByCustomerId(customerB._id);
  assert(
    bPackagesBefore.some((p) => String(p._id) === String(walletPkg._id)),
    "Customer B sees family-linked wallet as active"
  );

  const redeemInvoice = await callCreateInvoice({
    customer_id: customerB._id,
    customer_name: customerB.name,
    customer_phone: customerB.phone,
    payment_mode: "cash",
    payment_status: "paid",
    line_items: [
      {
        item_type: "service",
        item_name: "Test Hair Service",
        staff_id: staffId,
        quantity: 1,
        unit_price: 450,
        package_redemption_id: walletPkg._id,
      },
    ],
  });

  assert(Number(redeemInvoice.grand_total) === 0, "₹450 fully covered by wallet → grand_total ₹0");

  const redeemLine = (redeemInvoice.line_items || []).find(
    (li) => String(li.package_redemption_id) === String(walletPkg._id)
  );
  assert(redeemLine, "Invoice line has package_redemption_id");
  assert(Number(redeemLine.tax_rate) === 0, "Wallet redemption line GST is 0%");
  assert(Number(redeemLine.wallet_deduction_amount || 0) === 450, "Wallet deduction is ₹450");

  walletPkg = await CustomerPackage.findById(walletPkg._id);
  assert(Number(walletPkg.wallet_balance) === 9550, "Wallet balance after ₹450 redeem is ₹9550");
  assert(walletPkg.status === "active", "Wallet still active after partial use");

  // ── Row 21: Overspend remainder ───────────────────────────────────────────
  console.log("\n[test] Row 21 — Balance ₹200, service ₹500 → charge ₹300, wallet exhausted…");

  walletPkg.wallet_balance = 200;
  walletPkg.status = "active";
  await walletPkg.save();

  const overspendInvoice = await callCreateInvoice({
    customer_id: customerB._id,
    customer_name: customerB.name,
    customer_phone: customerB.phone,
    payment_mode: "cash",
    payment_status: "paid",
    line_items: [
      {
        item_type: "service",
        item_name: "Premium Service Overspend",
        staff_id: staffId,
        quantity: 1,
        unit_price: 500,
        package_redemption_id: walletPkg._id,
      },
    ],
  });

  assert(
    Number(overspendInvoice.grand_total) === 300,
    "Service ₹500 with ₹200 wallet → customer pays ₹300"
  );

  walletPkg = await CustomerPackage.findById(walletPkg._id);
  assert(Number(walletPkg.wallet_balance) === 0, "Wallet balance is ₹0 after overspend");
  assert(walletPkg.status === "exhausted", "Wallet status is exhausted");

  // ── Row 22: Remove family member ──────────────────────────────────────────
  console.log("\n[test] Row 22 — Remove B from family → B no longer eligible at POS…");

  walletPkg.wallet_balance = 10000;
  walletPkg.status = "active";
  walletPkg.linked_family_customer_ids = [customerB._id];
  await walletPkg.save();

  const linkedBefore = await getActivePackagesByCustomerId(customerB._id);
  assert(
    linkedBefore.some((p) => String(p._id) === String(walletPkg._id)),
    "B eligible before remove"
  );

  await removeFamilyMember(walletPkg._id, customerB._id);

  const linkedAfter = await getActivePackagesByCustomerId(customerB._id);
  assert(
    !linkedAfter.some((p) => String(p._id) === String(walletPkg._id)),
    "B not eligible after family remove"
  );

  // ── Row 23: Void restores wallet ──────────────────────────────────────────
  console.log("\n[test] Row 23 — Void ₹450 redemption invoice → balance restored to ₹10000…");

  walletPkg = await CustomerPackage.findById(walletPkg._id);
  walletPkg.wallet_balance = 10000;
  walletPkg.status = "active";
  walletPkg.linked_family_customer_ids = [];
  await walletPkg.save();
  await addFamilyMember(walletPkg._id, customerB._id);
  walletPkg = await CustomerPackage.findById(walletPkg._id);

  const voidTargetInvoice = await callCreateInvoice({
    customer_id: customerB._id,
    customer_name: customerB.name,
    customer_phone: customerB.phone,
    payment_mode: "cash",
    payment_status: "paid",
    line_items: [
      {
        item_type: "service",
        item_name: "Void Test Service",
        staff_id: staffId,
        quantity: 1,
        unit_price: 450,
        package_redemption_id: walletPkg._id,
      },
    ],
  });

  walletPkg = await CustomerPackage.findById(walletPkg._id);
  assert(Number(walletPkg.wallet_balance) === 9550, "Balance is ₹9550 before void");

  await callVoidInvoice(voidTargetInvoice.id || voidTargetInvoice._id, "Test wallet void restore");

  walletPkg = await CustomerPackage.findById(walletPkg._id);
  assert(Number(walletPkg.wallet_balance) === 10000, "Void restores wallet balance to ₹10000");
  assert(walletPkg.status === "active", "Wallet active again after void restore");

  console.log("\n[test] All Feature 3 wallet family tests passed (rows 20–23).\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[test] FAILED:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
