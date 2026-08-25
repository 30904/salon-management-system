/**
 * Quick row-10 smoke test for importCustomers (synthetic phones only).
 * Usage: node seeds/testImportCustomersRow10.js
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import CustomerImportBatch from "../models/CustomerImportBatch.js";
import { importCustomers } from "../services/customerImportService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const fakeUser = new mongoose.Types.ObjectId();
  const phones = ["9000000001", "9000000003"];

  await Customer.deleteMany({ phone: { $in: phones } });

  const rows = [
    {
      row: 2,
      name: "Import Test A",
      phone: "9000000001",
      notes: "Alt phones: 9000000002 | Email: a@test.com",
      import_row_ref: "2",
    },
    {
      row: 3,
      name: "Import Test B",
      phone: "9000000001",
      notes: "Email: b@test.com",
      gender: "female",
      import_row_ref: "3",
    },
    {
      row: 4,
      name: "",
      phone: "9000000003",
      notes: null,
      import_row_ref: "4",
    },
    {
      row: 5,
      name: "No Phone",
      phone: null,
      notes: null,
      import_row_ref: "5",
    },
  ];

  const batch = await importCustomers({
    rows,
    uploadedBy: fakeUser,
    fileName: "row10-test.xlsx",
  });

  console.log(
    JSON.stringify(
      {
        status: batch.status,
        total: batch.total_rows,
        created: batch.created_count,
        merged: batch.merged_count,
        skipped: batch.skipped_count,
        errors: batch.error_rows.length,
      },
      null,
      2
    )
  );

  const cust = await Customer.findOne({ phone: "9000000001" }).lean();
  console.log(
    JSON.stringify(
      {
        name: cust?.name,
        gender: cust?.gender,
        source: cust?.source,
        keptOriginalNotes: cust?.notes?.startsWith("Alt phones"),
      },
      null,
      2
    )
  );

  if (batch.created_count !== 1 || batch.merged_count !== 1 || batch.skipped_count !== 2) {
    throw new Error("Unexpected batch counts");
  }
  if (cust?.name !== "Import Test A") {
    throw new Error("Merge overwrote name — should keep original");
  }
  if (cust?.gender !== "female") {
    throw new Error("Merge should fill empty gender");
  }

  await Customer.deleteMany({ phone: { $in: phones } });
  await CustomerImportBatch.deleteOne({ _id: batch._id });
  await mongoose.disconnect();
  console.log("[test] importCustomers row-10 smoke passed");
}

main().catch(async (err) => {
  console.error("[test] FAILED:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
