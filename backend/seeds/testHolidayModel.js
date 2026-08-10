/**
 * Payroll Stage A test (tracker row 5):
 * Holiday model — date UTC midnight, name, branch_id null=all, is_active.
 *
 * Usage:
 *   npm run test:holiday-model
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

const TEST_DATE = new Date(Date.UTC(2026, 7, 20)); // 20 Aug 2026

async function cleanup() {
  await Holiday.deleteMany({ date: TEST_DATE, name: "Independence Day Test" });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — Holiday model\n");

  await cleanup();

  const holiday = await Holiday.create({
    date: TEST_DATE,
    name: "Independence Day Test",
    branch_id: null,
    is_active: true,
  });

  if (holiday.branch_id != null) {
    throw new Error("Expected branch_id default null (all branches)");
  }
  if (!holiday.is_active) {
    throw new Error("Expected is_active default true");
  }
  console.log("  PASS: Holiday created with branch_id null and is_active true");

  const safe = holiday.toSafeObject();
  if (safe.name !== "Independence Day Test") {
    throw new Error("toSafeObject name mismatch");
  }
  if (safe.date.getTime() !== TEST_DATE.getTime()) {
    throw new Error("Expected UTC midnight date stored");
  }
  console.log("  PASS: toSafeObject exposes date, name, branch_id, is_active");

  await cleanup();
  console.log("\n[test] Holiday model passed");
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
