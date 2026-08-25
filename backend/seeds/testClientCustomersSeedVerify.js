/**
 * Feature 2 tracker row 15 — verify client seed counts / unique phones.
 * Prints aggregates + pass/fail only (no customer PII).
 *
 * Usage:
 *   node seeds/testClientCustomersSeedVerify.js
 */
import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import CustomerImportBatch from "../models/CustomerImportBatch.js";
import { CLIENT_CONTACTS_IMPORT_FILE } from "../constants/customerImportConstants.js";
import { parseCustomerImportFile } from "../services/customerImportService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_FILE = path.resolve(__dirname, "../../", CLIENT_CONTACTS_IMPORT_FILE);

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

async function main() {
  if (!fs.existsSync(ROOT_FILE)) {
    throw new Error(`Missing ${ROOT_FILE}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("[test] Verify client customer seed counts\n");

  const parsed = parseCustomerImportFile(fs.readFileSync(ROOT_FILE), {
    fileName: CLIENT_CONTACTS_IMPORT_FILE,
  });

  const fileValidPhones = parsed.rows
    .map((r) => r.phone)
    .filter(Boolean);
  const fileUniquePhones = new Set(fileValidPhones);
  const fileInvalidRows = parsed.rows.filter((r) => !r.name || !r.phone).length;

  const totalCustomers = await Customer.countDocuments({});
  const uniquePhones = await Customer.distinct("phone");
  const dupGroup = await Customer.aggregate([
    { $group: { _id: "$phone", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "dups" },
  ]);
  const dupCount = dupGroup[0]?.dups || 0;

  const latestBatch = await CustomerImportBatch.findOne()
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    JSON.stringify(
      {
        file_rows: parsed.rows.length,
        file_valid_phone_rows: fileValidPhones.length,
        file_unique_phones: fileUniquePhones.size,
        file_invalid_rows: fileInvalidRows,
        db_customers: totalCustomers,
        db_unique_phones: uniquePhones.length,
        db_duplicate_phone_groups: dupCount,
        batch_created: latestBatch?.created_count,
        batch_merged: latestBatch?.merged_count,
        batch_skipped: latestBatch?.skipped_count,
      },
      null,
      2
    )
  );

  assert(totalCustomers > 0, "DB has customers after seed");
  assert(
    totalCustomers === uniquePhones.length,
    `Customer.countDocuments (${totalCustomers}) equals unique phones (${uniquePhones.length})`
  );
  assert(dupCount === 0, "No duplicate phone groups in DB");
  assert(
    totalCustomers === fileUniquePhones.size,
    `DB unique phones (${totalCustomers}) ≈ file unique phones (${fileUniquePhones.size})`
  );
  assert(
    latestBatch?.skipped_count >= fileInvalidRows ||
      latestBatch?.skipped_count > 0,
    "Invalid/no-mobile rows were skipped (error_rows / skipped > 0)"
  );
  assert(
    totalCustomers < parsed.rows.length,
    `Created (${totalCustomers}) < file rows (${parsed.rows.length}) as expected`
  );

  // Sample match: first 5 file rows with valid phone must exist in DB with same name
  const sampleRows = parsed.rows.filter((r) => r.phone && r.name).slice(0, 5);
  let matched = 0;
  for (const row of sampleRows) {
    const doc = await Customer.findOne({ phone: row.phone }).select("name phone").lean();
    if (doc && doc.name === row.name && doc.phone === row.phone) matched += 1;
  }
  assert(
    matched === sampleRows.length,
    `Sample Full Name + phone match DB (${matched}/${sampleRows.length})`
  );

  await mongoose.disconnect();
  console.log("\n[test] Client customer seed verify passed");
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
