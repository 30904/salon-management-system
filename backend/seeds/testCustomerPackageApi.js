import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import Customer from "../models/Customer.js";
import PackageMaster from "../models/PackageMaster.js";
import CustomerPackage from "../models/CustomerPackage.js";
import packageRoutes from "../routes/packageRoutes.js";
import customerRoutes from "../routes/customerRoutes.js";
import { signAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting CustomerPackage Sale API (`POST /api/customer-packages/sale`) Tests...\n");

  let adminUser = await User.findOne({ is_active: true });
  if (!adminUser) {
    adminUser = await User.findOne();
  }
  if (!adminUser) {
    throw new Error("Need at least 1 user in DB to test protected package routes");
  }

  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({
      name: "API Test Customer",
      phone: "9811223344",
      email: "apitestcustomer@s21.com",
    });
  }

  let pkgMaster = await PackageMaster.findOne({ is_active: true });
  if (!pkgMaster) {
    pkgMaster = await PackageMaster.create({
      name: "Platinum Facial & Massage Bundle",
      type: "prepaid_bundle",
      validity_days: 60,
      price: 7500,
      credit_count: 8,
      is_active: true,
    });
  }

  console.log(`[test] Using Admin User      : ${adminUser.name} (${adminUser._id})`);
  console.log(`[test] Target Customer       : ${customer.name} (${customer._id})`);
  console.log(`[test] PackageMaster Template: ${pkgMaster.name} (Validity: ${pkgMaster.validity_days} days, Credits: ${pkgMaster.credit_count})\n`);

  const testInvoiceId = "INV-SALE-API-999";
  await CustomerPackage.deleteMany({ invoice_id: testInvoiceId });

  // Helper function to dispatch mock request through express router
  async function dispatchRoute(mockReq) {
    return new Promise((resolve, reject) => {
      let responseData = null;
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          responseData = data;
          resolve({ data, err: null });
          return mockRes;
        },
      };
      packageRoutes.handle(mockReq, mockRes, (err) => {
        if (err) resolve({ data: null, err });
        else if (!responseData) resolve({ data: null, err: new Error("No response sent") });
      });
    });
  }

  // 1. Test POST /sale
  console.log("[test] 1. Testing POST /sale endpoint...");
  const mockReqSale = {
    method: "POST",
    url: "/sale",
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
    body: {
      customer_id: customer._id,
      package_master_id: pkgMaster._id,
      invoice_id: testInvoiceId,
    },
  };

  const { data: saleRes, err: saleErr } = await dispatchRoute(mockReqSale);
  if (saleErr) throw saleErr;

  if (!saleRes?.success || !saleRes?.data?.id) {
    throw new Error(`Sale API failed: ${JSON.stringify(saleRes)}`);
  }

  const createdRecord = saleRes.data;
  console.log("       Sale Status         :", saleRes.success);
  console.log("       CustomerPackage ID  :", createdRecord.id);
  console.log("       Credits Remaining   :", createdRecord.credits_remaining);
  console.log("       Status              :", createdRecord.status);
  console.log("       Purchase Date       :", new Date(createdRecord.purchase_date).toISOString().split("T")[0]);
  console.log("       Expiry Date         :", new Date(createdRecord.expiry_date).toISOString().split("T")[0]);
  console.log("       Populated Customer  :", createdRecord.customer?.name);
  console.log("       Populated Package   :", createdRecord.package_master?.name);

  // Check calculation verification
  if (createdRecord.credits_remaining !== pkgMaster.credit_count) {
    throw new Error(`Expected ${pkgMaster.credit_count} credits, got ${createdRecord.credits_remaining}`);
  }

  const purchaseDt = new Date(createdRecord.purchase_date);
  const expiryDt = new Date(createdRecord.expiry_date);
  const diffDays = Math.round((expiryDt.getTime() - purchaseDt.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays !== pkgMaster.validity_days) {
    throw new Error(`Expected expiry validity of ${pkgMaster.validity_days} days, got ${diffDays} days`);
  }
  console.log(`       -> Verified: Expiry exactly ${diffDays} days from purchase & ${createdRecord.credits_remaining} credits copied from PackageMaster template!\n`);

  // 2. Test GET /api/customer-packages (listing)
  console.log("[test] 2. Testing GET / (list packages)...");
  const mockReqList = {
    method: "GET",
    url: "/",
    query: { customer_id: customer._id.toString() },
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
  };

  const { data: listRes, err: listErr } = await dispatchRoute(mockReqList);
  if (listErr) throw listErr;

  if (!listRes?.success || !Array.isArray(listRes?.data) || listRes.data.length === 0) {
    throw new Error(`List packages failed: ${JSON.stringify(listRes)}`);
  }
  console.log("       Packages Found      :", listRes.data.length);
  console.log("       -> Verified: `GET /api/customer-packages` lists customer's active package records!\n");

  // 3. Test POST /:id/redeem
  console.log("[test] 3. Testing POST /:id/redeem (credit deduction)...");
  const mockReqRedeem = {
    method: "POST",
    url: `/${createdRecord.id}/redeem`,
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
    body: { credits_used: 1 },
  };

  const { data: redeemRes, err: redeemErr } = await dispatchRoute(mockReqRedeem);
  if (redeemErr) throw redeemErr;

  if (!redeemRes?.success || redeemRes.data.credits_remaining !== pkgMaster.credit_count - 1) {
    throw new Error(`Redeem failed: ${JSON.stringify(redeemRes)}`);
  }
  console.log("       Credits Remaining after redeem:", redeemRes.data.credits_remaining);
  console.log("       -> Verified: Credit successfully deducted during redemption!\n");

  // Helper function to dispatch mock request through customerRoutes
  async function dispatchCustomerRoute(mockReq) {
    return new Promise((resolve, reject) => {
      let responseData = null;
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          responseData = data;
          resolve({ data, err: null });
          return mockRes;
        },
      };
      customerRoutes.handle(mockReq, mockRes, (err) => {
        if (err) resolve({ data: null, err });
        else if (!responseData) resolve({ data: null, err: new Error("No response sent") });
      });
    });
  }

  // 4. Test GET /api/customers/:id/packages/active
  console.log("[test] 4. Testing GET /api/customers/:id/packages/active (billing redemption UI)...");
  const mockReqActive = {
    method: "GET",
    url: `/${customer._id}/packages/active`,
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
  };

  const { data: activeRes, err: activeErr } = await dispatchCustomerRoute(mockReqActive);
  if (activeErr) throw activeErr;

  if (!activeRes?.success || !Array.isArray(activeRes?.data) || activeRes.data.length === 0) {
    throw new Error(`GET /api/customers/:id/packages/active failed: ${JSON.stringify(activeRes)}`);
  }
  console.log("       Active Packages Found:", activeRes.data.length);
  console.log("       Sample Package Name  :", activeRes.data[0].package_master?.name);
  console.log("       Credits Remaining    :", activeRes.data[0].credits_remaining);
  console.log("       -> Verified: `GET /api/customers/:id/packages/active` returns active packages for billing UI!\n");

  // 5. Test Expiry/low-credit alert triggers (`POST /api/customer-packages/alerts/trigger`)
  console.log("[test] 5. Testing Expiry/low-credit alert triggers (WhatsApp scheduler events)...");
  // Set credits_remaining = 2 on createdRecord so it qualifies as low credit (or within 95 expiry days threshold)
  await CustomerPackage.findByIdAndUpdate(createdRecord.id, { credits_remaining: 2 });

  const mockReqTrigger = {
    method: "POST",
    url: "/alerts/trigger",
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
    body: { expiry_days_threshold: 95, low_credit_threshold: 2 },
  };

  const { data: triggerRes, err: triggerErr } = await dispatchRoute(mockReqTrigger);
  if (triggerErr) throw triggerErr;

  if (!triggerRes?.success || triggerRes.data.totalEmitted === 0) {
    throw new Error(`Alert trigger failed or 0 emitted: ${JSON.stringify(triggerRes)}`);
  }
  console.log("       Expiry Alerts Emitted   :", triggerRes.data.expiringSoonAlerts.length);
  console.log("       Low Credit Alerts Emitted:", triggerRes.data.lowCreditAlerts.length);

  // Check alert history buffer for WhatsApp scheduler
  const mockReqHistory = {
    method: "GET",
    url: "/alerts/history",
    headers: { authorization: `Bearer ${signAccessToken({ sub: adminUser._id })}` },
  };
  const { data: histRes, err: histErr } = await dispatchRoute(mockReqHistory);
  if (histErr) throw histErr;

  console.log("       WhatsApp Scheduler Queue:", histRes.data.length, "message(s) queued");
  if (histRes.data.length > 0) {
    console.log("       Sample Queued Message   :", `"${histRes.data[0].message_text}" (${histRes.data[0].status})`);
  }
  console.log("       -> Verified: Expiry & low-credit events successfully emitted for WhatsApp scheduler!\n");

  // Cleanup
  await CustomerPackage.findByIdAndDelete(createdRecord.id);
  console.log("[test] Cleaned up test CustomerPackage record.");

  console.log("\n[test] All CustomerPackage requirements verified successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test Failed:", err.message || err);
  process.exit(1);
});
