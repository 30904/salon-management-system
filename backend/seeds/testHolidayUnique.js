/**
 * Payroll Stage A test (tracker row 7):
 * Insert 2-3 holidays; duplicate date blocked (unique date index).
 *
 * Usage:
 *   npm run test:holiday-unique
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

const DATES = [
  new Date(Date.UTC(2026, 7, 24)), // 24 Aug
  new Date(Date.UTC(2026, 7, 25)), // 25 Aug
  new Date(Date.UTC(2026, 7, 26)), // 26 Aug
];

async function cleanup() {
  await Holiday.deleteMany({
    date: { $in: DATES },
    name: { $regex: /^Holiday Unique Test/ },
  });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — Holiday unique date blocked\n");

  await Holiday.syncIndexes();
  await cleanup();

  const first = await Holiday.create({
    date: DATES[0],
    name: "Holiday Unique Test A",
    branch_id: null,
  });
  console.log(`  PASS: inserted holiday ${first._id.toString().slice(-6)} on ${DATES[0].toISOString().slice(0, 10)}`);

  const second = await Holiday.create({
    date: DATES[1],
    name: "Holiday Unique Test B",
    branch_id: null,
  });
  console.log(`  PASS: inserted holiday ${second._id.toString().slice(-6)} on ${DATES[1].toISOString().slice(0, 10)}`);

  const third = await Holiday.create({
    date: DATES[2],
    name: "Holiday Unique Test C",
    branch_id: null,
  });
  console.log(`  PASS: inserted holiday ${third._id.toString().slice(-6)} on ${DATES[2].toISOString().slice(0, 10)}`);

  let duplicateRejected = false;
  try {
    await Holiday.create({
      date: DATES[0],
      name: "Holiday Unique Test Duplicate",
      branch_id: null,
    });
  } catch (error) {
    if (error?.code === 11000 || String(error.message || "").includes("E11000")) {
      duplicateRejected = true;
      console.log("  PASS: duplicate same date + branch_id rejected (E11000)");
    } else {
      throw error;
    }
  }

  if (!duplicateRejected) {
    throw new Error("Expected duplicate date insert to fail with unique index error");
  }

  await cleanup();
  console.log("\n[test] Holiday unique date blocked passed");
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
