/**
 * Feature 2 tracker row 32 / MD 2.8 — CSV 5-row import mix.
 * 2 new + 2 merge (existing phones) + 1 missing phone → error_rows.
 * Re-run same file → no duplicate phones, batch still completes.
 *
 * Usage:
 *   npm run test:import-csv-5row
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import CustomerImportBatch from "../models/CustomerImportBatch.js";
import {
  importCustomers,
  parseCustomerImportFile,
} from "../services/customerImportService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

const PHONES = {
  existing1: "9900000101",
  existing2: "9900000102",
  new1: "9900000103",
  new2: "9900000104",
};

const FILE_NAME = "feature2-five-row-mix.csv";

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

function buildCsv() {
  return [
    "name,phone,gender,notes",
    `Fresh Import One,${PHONES.new1},,First new customer`,
    `Fresh Import Two,${PHONES.new2},female,Second new customer`,
    `Merge Attempt One,${PHONES.existing1},male,Merge notes for existing one`,
    `Merge Attempt Two,${PHONES.existing2},,Merge notes for existing two`,
    "Missing Phone Person,,,Should land in error_rows",
  ].join("\n");
}

async function countDuplicatePhones(phones) {
  const dupGroup = await Customer.aggregate([
    { $match: { phone: { $in: phones } } },
    { $group: { _id: "$phone", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "dups" },
  ]);
  return dupGroup[0]?.dups || 0;
}

async function cleanup() {
  await Customer.deleteMany({ phone: { $in: Object.values(PHONES) } });
  await CustomerImportBatch.deleteMany({ file_name: FILE_NAME });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const uploadedBy = new mongoose.Types.ObjectId();

  console.log("[test] CSV 5-row import mix (Feature 2 row 32)\n");

  await cleanup();

  await Customer.create([
    {
      name: "Existing One",
      phone: PHONES.existing1,
      source: "app",
      notes: null,
      gender: null,
    },
    {
      name: "Existing Two",
      phone: PHONES.existing2,
      source: "app",
      notes: null,
      gender: null,
    },
  ]);

  const csvBuffer = Buffer.from(buildCsv(), "utf8");
  const parsed = parseCustomerImportFile(csvBuffer, {
    fileName: FILE_NAME,
    mimeType: "text/csv",
  });

  assert(parsed.rows.length === 5, "CSV parser yields 5 data rows");

  const batch1 = await importCustomers({
    rows: parsed.rows,
    uploadedBy,
    fileName: FILE_NAME,
  });

  assert(batch1.status === "completed", "First import batch completes (not crashed)");
  assert(batch1.created_count === 2, "First import created=2 new customers");
  assert(batch1.merged_count === 2, "First import merged=2 existing phones");
  assert(batch1.skipped_count === 1, "First import skipped=1 missing-phone row");
  assert(batch1.error_rows.length === 1, "Missing phone row is in error_rows");
  assert(
    batch1.error_rows[0]?.reason?.includes("phone"),
    "error_rows reason mentions invalid/missing phone"
  );

  const afterFirst = await Customer.countDocuments({
    phone: { $in: Object.values(PHONES) },
  });
  assert(afterFirst === 4, "Exactly 4 customers for test phones after first import");
  assert(
    (await countDuplicatePhones(Object.values(PHONES))) === 0,
    "No duplicate phone groups after first import"
  );

  const existingOne = await Customer.findOne({ phone: PHONES.existing1 }).lean();
  const existingTwo = await Customer.findOne({ phone: PHONES.existing2 }).lean();
  assert(existingOne?.name === "Existing One", "Merge did not overwrite existing name");
  assert(existingOne?.gender === "male", "Merge filled empty gender on existing one");
  assert(existingTwo?.name === "Existing Two", "Merge did not overwrite existing two name");
  assert(
    String(existingTwo?.notes || "").includes("Merge notes"),
    "Merge filled empty notes on existing two"
  );

  const batch2 = await importCustomers({
    rows: parsed.rows,
    uploadedBy,
    fileName: FILE_NAME,
  });

  assert(batch2.status === "completed", "Re-run batch completes");
  assert(batch2.created_count === 0, "Re-run created=0 (no duplicates)");
  assert(batch2.merged_count === 4, "Re-run merged=4 existing rows");
  assert(batch2.skipped_count === 1, "Re-run still skips missing-phone row");
  assert(batch2.error_rows.length === 1, "Re-run keeps missing phone in error_rows");

  const afterSecond = await Customer.countDocuments({
    phone: { $in: Object.values(PHONES) },
  });
  assert(afterSecond === 4, "Re-run did not create duplicate customers");
  assert(
    (await countDuplicatePhones(Object.values(PHONES))) === 0,
    "No duplicate phone groups after re-run"
  );

  console.log(
    JSON.stringify(
      {
        first: {
          created: batch1.created_count,
          merged: batch1.merged_count,
          skipped: batch1.skipped_count,
          errors: batch1.error_rows.length,
        },
        rerun: {
          created: batch2.created_count,
          merged: batch2.merged_count,
          skipped: batch2.skipped_count,
          errors: batch2.error_rows.length,
        },
        customers_for_test_phones: afterSecond,
      },
      null,
      2
    )
  );

  await CustomerImportBatch.deleteOne({ _id: batch1._id });
  await CustomerImportBatch.deleteOne({ _id: batch2._id });
  await Customer.deleteMany({ phone: { $in: Object.values(PHONES) } });
  await mongoose.disconnect();
  console.log("\n[test] CSV 5-row import mix passed");
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message || err);
  try {
    await cleanup();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
