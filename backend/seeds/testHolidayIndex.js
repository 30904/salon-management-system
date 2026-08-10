/**
 * Payroll Stage A test (tracker row 6):
 * Holiday index {date, branch_id} — supports month range queries.
 *
 * Usage:
 *   npm run test:holiday-index
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Holiday from "../models/Holiday.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const TEST_DATES = [
  new Date(Date.UTC(2026, 7, 21)),
  new Date(Date.UTC(2026, 7, 22)),
  new Date(Date.UTC(2026, 7, 23)),
];

async function cleanup() {
  await Holiday.deleteMany({
    date: { $in: TEST_DATES },
    name: { $regex: /^Holiday Index Test/ },
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — Holiday index {date, branch_id}\n");

  await Holiday.syncIndexes();
  await cleanup();

  const indexes = await Holiday.collection.indexes();
  const compound = indexes.find(
    (idx) => idx.key?.date === 1 && idx.key?.branch_id === 1
  );
  if (!compound) {
    throw new Error("Expected compound index on { date: 1, branch_id: 1 }");
  }
  if (!compound.unique) {
    throw new Error("Expected { date, branch_id } index to be unique");
  }
  console.log("  PASS: unique index { date: 1, branch_id: 1 } declared");

  await Holiday.create([
    {
      date: TEST_DATES[0],
      name: "Holiday Index Test A",
      branch_id: null,
    },
    {
      date: TEST_DATES[1],
      name: "Holiday Index Test B",
      branch_id: null,
    },
    {
      date: TEST_DATES[2],
      name: "Holiday Index Test C",
      branch_id: null,
    },
  ]);
  console.log("  PASS: inserted 3 holidays on distinct dates");

  const august = await Holiday.find({
    date: {
      $gte: new Date(Date.UTC(2026, 7, 1)),
      $lte: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
    },
    name: { $regex: /^Holiday Index Test/ },
  }).sort({ date: 1 });

  if (august.length !== 3) {
    throw new Error(`Expected 3 August holidays, got ${august.length}`);
  }
  console.log("  PASS: month range query returns expected holidays");

  await cleanup();
  console.log("\n[test] Holiday index passed");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[test] Failed:", error.message);
  try {
    await cleanup();
  } catch {
    // ignore
  }
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
