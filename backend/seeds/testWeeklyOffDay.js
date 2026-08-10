/**
 * Leave Stage 1 test (tracker row 5):
 * Reject weekly_off_day=5 (Fri); accept weekly_off_day=2 (Tue).
 *
 * Usage:
 *   npm run test:weekly-off-day
 */
import mongoose from "mongoose";
import StaffProfile from "../models/StaffProfile.js";

async function expectReject(value) {
  const doc = new StaffProfile({
    user_id: new mongoose.Types.ObjectId(),
    designation: "Test Stylist",
    weekly_off_day: value,
  });

  try {
    await doc.validate();
    throw new Error(`Expected weekly_off_day=${value} to be rejected, but validation passed`);
  } catch (error) {
    if (error.message?.includes("Expected weekly_off_day")) throw error;
    const pathError = error.errors?.weekly_off_day;
    if (!pathError) throw error;
    console.log(`  PASS: weekly_off_day=${value} rejected — ${pathError.message}`);
  }
}

async function expectAccept(value) {
  const doc = new StaffProfile({
    user_id: new mongoose.Types.ObjectId(),
    designation: "Test Stylist",
    weekly_off_day: value,
  });
  await doc.validate();
  console.log(`  PASS: weekly_off_day=${value} accepted`);
}

async function main() {
  console.log("[test] StaffProfile.weekly_off_day validator (Leave Stage 1)\n");

  await expectReject(5); // Friday
  await expectReject(6); // Saturday
  await expectReject(0); // Sunday
  await expectAccept(2); // Tuesday
  await expectAccept(1); // Monday (default allowed)

  console.log("\n[test] All weekly_off_day checks passed");
}

main().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
