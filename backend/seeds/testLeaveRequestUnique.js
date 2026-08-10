/**
 * Leave Stage 2 test (tracker row 10):
 * Insert one LeaveRequest; duplicate {staff_id, date} must fail (unique index).
 *
 * Usage:
 *   npm run test:leave-request-unique
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

function normalizeUtcMidnight(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] Connected — LeaveRequest unique {staff_id, date}\n");

  // Ensure indexes exist on this collection (unique index must be present)
  await LeaveRequest.syncIndexes();

  const staffId = new mongoose.Types.ObjectId();
  const date = normalizeUtcMidnight(new Date("2026-08-11T00:00:00.000Z")); // Tuesday

  // Clean any leftover from prior runs for this synthetic staff/date
  await LeaveRequest.deleteMany({ staff_id: staffId, date });

  const payload = {
    staff_id: staffId,
    date,
    leave_type: "extra_leave",
    status: "pending",
    is_paid: true,
    reason: "Stage 2 unique-index test",
  };

  const first = await LeaveRequest.create(payload);
  console.log(`  PASS: inserted LeaveRequest ${first._id}`);

  let duplicateRejected = false;
  try {
    await LeaveRequest.create(payload);
  } catch (error) {
    if (error?.code === 11000 || String(error.message || "").includes("E11000")) {
      duplicateRejected = true;
      console.log("  PASS: duplicate {staff_id, date} rejected (E11000)");
    } else {
      throw error;
    }
  }

  if (!duplicateRejected) {
    throw new Error("Expected duplicate insert to fail with unique index error");
  }

  await LeaveRequest.deleteMany({ staff_id: staffId, date });
  console.log("  cleaned up test LeaveRequest row(s)");
  console.log("\n[test] Unique index confirmed");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[test] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
