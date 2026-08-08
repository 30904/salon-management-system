/**
 * Wipe all CRM customers and related transactional demo data.
 *
 * Deletes:
 *   - Bookings linked to those customers (and leftover dashboard-demo bookings)
 *   - Invoice line items + commission entries for customer invoices
 *   - Invoices for those customers
 *   - Customer packages
 *   - WhatsApp campaigns (audience tied to customers)
 *   - Customer documents
 *
 * Does NOT touch: users, staff, services, products, shifts, roles.
 *
 * Usage:
 *   npm run seed:clear-customers
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Customer from "../models/Customer.js";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import WhatsAppCampaign from "../models/WhatsAppCampaign.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

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
    console.warn("[clear-customers] SRV DNS failed — retrying with standard Mongo URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  const mode = await connectMongo(uri);
  console.log(`[clear-customers] Connected (${mode})`);

  const customers = await Customer.find({}).select("_id name phone notes").lean();
  const customerIds = customers.map((row) => row._id);

  console.log(`[clear-customers] Found ${customers.length} customer(s)`);

  const invoices = customerIds.length
    ? await Invoice.find({ customer_id: { $in: customerIds } }).select("_id").lean()
    : [];
  const invoiceIds = invoices.map((row) => row._id);

  const lineItems = invoiceIds.length
    ? await InvoiceLineItem.find({ invoice_id: { $in: invoiceIds } }).select("_id").lean()
    : [];
  const lineItemIds = lineItems.map((row) => row._id);

  const [
    bookingDelete,
    demoBookingDelete,
    commissionDelete,
    lineItemDelete,
    invoiceDelete,
    packageDelete,
    campaignDelete,
    customerDelete,
  ] = await Promise.all([
    customerIds.length
      ? Booking.deleteMany({ customer_id: { $in: customerIds } })
      : Promise.resolve({ deletedCount: 0 }),
    Booking.deleteMany({ notes: "dashboard-demo" }),
    lineItemIds.length
      ? CommissionEntry.deleteMany({ invoice_line_item_id: { $in: lineItemIds } })
      : Promise.resolve({ deletedCount: 0 }),
    invoiceIds.length
      ? InvoiceLineItem.deleteMany({ invoice_id: { $in: invoiceIds } })
      : Promise.resolve({ deletedCount: 0 }),
    invoiceIds.length
      ? Invoice.deleteMany({ _id: { $in: invoiceIds } })
      : Promise.resolve({ deletedCount: 0 }),
    customerIds.length
      ? CustomerPackage.deleteMany({ customer_id: { $in: customerIds } })
      : Promise.resolve({ deletedCount: 0 }),
    WhatsAppCampaign.deleteMany({}),
    customerIds.length
      ? Customer.deleteMany({ _id: { $in: customerIds } })
      : Promise.resolve({ deletedCount: 0 }),
  ]);

  console.log("[clear-customers] Deleted:");
  console.log(`  customers            = ${customerDelete.deletedCount || 0}`);
  console.log(`  bookings (by cust)   = ${bookingDelete.deletedCount || 0}`);
  console.log(`  bookings (demo note) = ${demoBookingDelete.deletedCount || 0}`);
  console.log(`  invoices             = ${invoiceDelete.deletedCount || 0}`);
  console.log(`  invoice line items   = ${lineItemDelete.deletedCount || 0}`);
  console.log(`  commission entries   = ${commissionDelete.deletedCount || 0}`);
  console.log(`  customer packages    = ${packageDelete.deletedCount || 0}`);
  console.log(`  whatsapp campaigns   = ${campaignDelete.deletedCount || 0}`);
  console.log("[clear-customers] Done. CRM customer list should be empty.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[clear-customers] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
