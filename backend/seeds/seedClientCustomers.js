/**
 * Seed/import client CRM customers from repo-root Contacts-24-Aug-02-31.xlsx.
 * Uses the same parse + importCustomers path as POST /api/customers/import
 * so a CustomerImportBatch audit row is created.
 *
 * Prints aggregate counts only (no customer PII in logs).
 *
 * Usage:
 *   npm run seed:client-customers
 */
import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import Customer from "../models/Customer.js";
import {
  CLIENT_CONTACTS_IMPORT_FILE,
} from "../constants/customerImportConstants.js";
import {
  parseCustomerImportFile,
  importCustomers,
} from "../services/customerImportService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_FILE = path.resolve(__dirname, "../../", CLIENT_CONTACTS_IMPORT_FILE);

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
    console.warn("[seed:client-customers] SRV DNS failed — retrying standard URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function resolveUploader() {
  const ownerRole = await Role.findOne({ name: ROLE_NAMES.OWNER });
  if (ownerRole) {
    const owner = await User.findOne({ role_id: ownerRole._id, is_active: true }).select("_id name");
    if (owner) return owner;
  }
  const anyUser = await User.findOne({ is_active: true }).select("_id name");
  if (!anyUser) {
    throw new Error("No active user found to set as uploaded_by — run seed:owner first");
  }
  return anyUser;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  if (!fs.existsSync(ROOT_FILE)) {
    throw new Error(
      `Client contacts file not found at ${ROOT_FILE}. Place ${CLIENT_CONTACTS_IMPORT_FILE} in the repo root.`
    );
  }

  const mode = await connectMongo(uri);
  console.log(`[seed:client-customers] Connected (${mode})`);
  console.log(`[seed:client-customers] File: ${ROOT_FILE}`);

  const beforeCount = await Customer.countDocuments({});
  console.log(`[seed:client-customers] Customers before import: ${beforeCount}`);

  const uploader = await resolveUploader();
  console.log(`[seed:client-customers] uploaded_by user id: ${uploader._id}`);

  const buffer = fs.readFileSync(ROOT_FILE);
  const parsed = parseCustomerImportFile(buffer, {
    fileName: CLIENT_CONTACTS_IMPORT_FILE,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const withPhone = parsed.rows.filter((r) => r.phone).length;
  console.log(
    `[seed:client-customers] Parsed sheet="${parsed.sheet_name}" rows=${parsed.rows.length} with_valid_phone=${withPhone}`
  );

  const batch = await importCustomers({
    rows: parsed.rows,
    uploadedBy: uploader._id,
    fileName: CLIENT_CONTACTS_IMPORT_FILE,
  });

  const afterCount = await Customer.countDocuments({});
  const uniquePhones = await Customer.distinct("phone");

  console.log("[seed:client-customers] Batch summary:");
  console.log(`  batch_id     = ${batch._id}`);
  console.log(`  status       = ${batch.status}`);
  console.log(`  total_rows   = ${batch.total_rows}`);
  console.log(`  created      = ${batch.created_count}`);
  console.log(`  merged       = ${batch.merged_count}`);
  console.log(`  skipped      = ${batch.skipped_count}`);
  console.log(`  error_rows   = ${(batch.error_rows || []).length}`);
  console.log(`  customers_now = ${afterCount}`);
  console.log(`  unique_phones = ${uniquePhones.length}`);
  console.log("[seed:client-customers] Done (no PII logged).");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed:client-customers] Failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
