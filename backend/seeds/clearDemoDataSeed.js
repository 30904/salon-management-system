/**
 * Remove seed:demo leftovers without touching real client data.
 *
 * Deletes:
 *   - Demo stylist users/profiles (Demo Stylist, Priya, Rahul / @salon.dev)
 *   - Demo bookings (dashboard-demo / demo-staff-earnings notes)
 *   - Demo customers (9100000* phones + demo notes)
 *   - Demo services (12 names from demoServicesProductsSeed)
 *   - Demo products (PRD-* SKUs)
 *   - Related commissions / attendance / invoices for those demos
 *
 * Keeps:
 *   - Owner + real staff
 *   - Client customers
 *   - Client inventory (INV-*)
 *   - Client wallet packages
 *   - Non-demo services already added manually
 *   - Service categories still in use
 *
 * Usage:
 *   npm run seed:clear-demo
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Booking from "../models/Booking.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Customer from "../models/Customer.js";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import ProductMaster from "../models/ProductMaster.js";
import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import {
  DEMO_SERVICE_CATEGORIES,
  DEMO_SERVICES,
  DEMO_PRODUCTS,
} from "./demoServicesProductsSeed.js";
import { DEV_STYLIST_CONFIG } from "./demoStaffEarningsSeed.js";
import { DASHBOARD_DEMO_NOTE } from "./demoDashboardSeed.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const DEMO_PHONES = [
  DEV_STYLIST_CONFIG.phone,
  "7777777771",
  "7777777772",
];

const DEMO_EMAILS = [
  DEV_STYLIST_CONFIG.email,
  "priya.stylist@salon.dev",
  "rahul.stylist@salon.dev",
];

const DEMO_NOTES = [DASHBOARD_DEMO_NOTE, "demo-staff-earnings"];
const DEMO_CUSTOMER_PHONE_PREFIX = "9100000";
const DEMO_SERVICE_NAMES = DEMO_SERVICES.map((s) => s.name);
const DEMO_PRODUCT_SKUS = DEMO_PRODUCTS.map((p) => p.sku);
const DEMO_CATEGORY_NAMES = DEMO_SERVICE_CATEGORIES.map((c) => c.name);

function toStandardMongoUri(srvUri) {
  const match = String(srvUri || "").match(
    /^mongodb\+srv:\/\/([^@]+)@([^/]+)\/([^?]+)?(\?.*)?$/i
  );
  if (!match) return null;

  const [, auth, , dbName = "s21management", query = ""] = match;
  const hosts = [
    "ac-vlysbzs-shard-00-00.uftuzf3.mongodb.net:27017",
    "ac-vlysbzs-shard-00-01.uftuzf3.mongodb.net:27017",
    "ac-vlysbzs-shard-00-02.uftuzf3.mongodb.net:27017",
  ].join(",");

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  params.set("ssl", "true");
  params.set("authSource", params.get("authSource") || "admin");
  params.set("retryWrites", params.get("retryWrites") || "true");
  params.set("w", params.get("w") || "majority");

  return `mongodb://${auth}@${hosts}/${dbName}?${params.toString()}`;
}

async function connectMongo(uri) {
  try {
    await mongoose.connect(uri);
    return "primary";
  } catch (error) {
    if (!String(uri).startsWith("mongodb+srv://")) throw error;
    if (!String(error.message || "").includes("querySrv")) throw error;
    const fallback = toStandardMongoUri(uri);
    if (!fallback) throw error;
    console.warn("[clear-demo] SRV DNS failed — retrying standard URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  const mode = await connectMongo(uri);
  console.log(`[clear-demo] Connected (${mode})`);

  const demoUsers = await User.find({
    $or: [
      { phone: { $in: DEMO_PHONES } },
      { email: { $in: DEMO_EMAILS } },
      { email: { $regex: /@salon\.dev$/i } },
    ],
  })
    .select("_id name phone email")
    .lean();
  const demoUserIds = demoUsers.map((u) => u._id);

  const demoProfiles = demoUserIds.length
    ? await StaffProfile.find({ user_id: { $in: demoUserIds } }).select("_id").lean()
    : [];
  const demoProfileIds = demoProfiles.map((p) => p._id);

  const demoCustomers = await Customer.find({
    $or: [
      { phone: { $regex: `^${DEMO_CUSTOMER_PHONE_PREFIX}` } },
      { notes: { $in: DEMO_NOTES } },
    ],
  })
    .select("_id")
    .lean();
  const demoCustomerIds = demoCustomers.map((c) => c._id);

  const demoInvoices = await Invoice.find({
    $or: [
      ...(demoCustomerIds.length ? [{ customer_id: { $in: demoCustomerIds } }] : []),
      { invoice_number: { $regex: /^DASH-/i } },
    ],
  })
    .select("_id")
    .lean();
  const demoInvoiceIds = demoInvoices.map((i) => i._id);

  const demoLineItems = demoInvoiceIds.length
    ? await InvoiceLineItem.find({ invoice_id: { $in: demoInvoiceIds } })
        .select("_id")
        .lean()
    : [];
  const demoLineItemIds = demoLineItems.map((l) => l._id);

  console.log(`[clear-demo] Demo users: ${demoUsers.length}`);
  for (const u of demoUsers) {
    console.log(`  - ${u.name} (${u.phone} / ${u.email})`);
  }
  console.log(`[clear-demo] Demo customers: ${demoCustomerIds.length}`);
  console.log(`[clear-demo] Demo invoices: ${demoInvoiceIds.length}`);

  const [
    bookingByNote,
    bookingByStylist,
    bookingByCustomer,
    commissionByStaff,
    commissionByLine,
    attendanceDelete,
    lineItemDelete,
    invoiceDelete,
    customerPackageDelete,
    customerDelete,
    profileDelete,
    userDelete,
    productDelete,
    serviceDelete,
  ] = await Promise.all([
    Booking.deleteMany({ notes: { $in: DEMO_NOTES } }),
    demoProfileIds.length
      ? Booking.deleteMany({ stylist_id: { $in: demoProfileIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoCustomerIds.length
      ? Booking.deleteMany({ customer_id: { $in: demoCustomerIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoProfileIds.length
      ? CommissionEntry.deleteMany({ staff_id: { $in: demoProfileIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoLineItemIds.length
      ? CommissionEntry.deleteMany({ invoice_line_item_id: { $in: demoLineItemIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoProfileIds.length
      ? Attendance.deleteMany({ staff_id: { $in: demoProfileIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoInvoiceIds.length
      ? InvoiceLineItem.deleteMany({ invoice_id: { $in: demoInvoiceIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoInvoiceIds.length
      ? Invoice.deleteMany({ _id: { $in: demoInvoiceIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoCustomerIds.length
      ? CustomerPackage.deleteMany({ customer_id: { $in: demoCustomerIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoCustomerIds.length
      ? Customer.deleteMany({ _id: { $in: demoCustomerIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoProfileIds.length
      ? StaffProfile.deleteMany({ _id: { $in: demoProfileIds } })
      : Promise.resolve({ deletedCount: 0 }),
    demoUserIds.length
      ? User.deleteMany({ _id: { $in: demoUserIds } })
      : Promise.resolve({ deletedCount: 0 }),
    ProductMaster.deleteMany({
      $or: [
        { sku: { $in: DEMO_PRODUCT_SKUS } },
        { sku: { $regex: /^PRD-/i } },
      ],
    }),
    ServiceMaster.deleteMany({ name: { $in: DEMO_SERVICE_NAMES } }),
  ]);

  // Drop demo categories only when empty (real services may still use Hair/Skin).
  let categoriesDeleted = 0;
  for (const name of DEMO_CATEGORY_NAMES) {
    const category = await ServiceCategory.findOne({ name }).select("_id").lean();
    if (!category) continue;
    const stillUsed = await ServiceMaster.countDocuments({ category_id: category._id });
    if (stillUsed === 0) {
      await ServiceCategory.deleteOne({ _id: category._id });
      categoriesDeleted += 1;
    }
  }

  // Orphan commissions tagged from demo invoice prefix (if any remain)
  const orphanDashCommissions = await CommissionEntry.deleteMany({
    invoice_reference: { $regex: /^DASH-/i },
  });

  console.log("[clear-demo] Deleted:");
  console.log(`  bookings (by note)      = ${bookingByNote.deletedCount || 0}`);
  console.log(`  bookings (demo stylist) = ${bookingByStylist.deletedCount || 0}`);
  console.log(`  bookings (demo cust)    = ${bookingByCustomer.deletedCount || 0}`);
  console.log(`  commissions (staff)     = ${commissionByStaff.deletedCount || 0}`);
  console.log(`  commissions (lines)     = ${commissionByLine.deletedCount || 0}`);
  console.log(`  commissions (DASH-*)    = ${orphanDashCommissions.deletedCount || 0}`);
  console.log(`  attendance              = ${attendanceDelete.deletedCount || 0}`);
  console.log(`  invoice lines           = ${lineItemDelete.deletedCount || 0}`);
  console.log(`  invoices                = ${invoiceDelete.deletedCount || 0}`);
  console.log(`  customer packages       = ${customerPackageDelete.deletedCount || 0}`);
  console.log(`  demo customers          = ${customerDelete.deletedCount || 0}`);
  console.log(`  staff profiles          = ${profileDelete.deletedCount || 0}`);
  console.log(`  users                   = ${userDelete.deletedCount || 0}`);
  console.log(`  demo products (PRD-*)   = ${productDelete.deletedCount || 0}`);
  console.log(`  demo services           = ${serviceDelete.deletedCount || 0}`);
  console.log(`  empty demo categories   = ${categoriesDeleted}`);

  console.log("[clear-demo] Remaining:");
  console.log(`  customers  = ${await Customer.countDocuments({})}`);
  console.log(`  bookings   = ${await Booking.countDocuments({})}`);
  console.log(`  products   = ${await ProductMaster.countDocuments({})}`);
  console.log(`  services   = ${await ServiceMaster.countDocuments({})}`);
  console.log(`  users      = ${await User.countDocuments({})}`);
  console.log(`  staff      = ${await StaffProfile.countDocuments({})}`);
  console.log("[clear-demo] Done (client inventory / real staff / client customers kept).");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[clear-demo] Failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
