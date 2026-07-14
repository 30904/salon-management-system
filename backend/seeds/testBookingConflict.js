import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/Customer.js";
import "../models/ServiceMaster.js";
import "../models/ShiftMaster.js";
import "../models/Booking.js";
import Booking from "../models/Booking.js";
import {
  assertNoBookingConflict,
  checkBookingConflict,
  intervalsOverlap,
} from "../services/bookingConflictService.js";
import { seedDemoStaffEarnings } from "./demoStaffEarningsSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function run() {
  await connectDB();

  console.log("[test] Booking conflict service (Sheet 04 row 4)");

  const overlap = intervalsOverlap(
    new Date("2026-07-14T10:00:00"),
    new Date("2026-07-14T11:00:00"),
    new Date("2026-07-14T10:30:00"),
    new Date("2026-07-14T11:30:00")
  );

  if (!overlap) {
    throw new Error("intervalsOverlap should detect overlapping ranges");
  }

  const seeded = await seedDemoStaffEarnings();
  const existingBooking = await Booking.findOne({
    stylist_id: seeded.profile._id,
    status: { $in: ["booked", "confirmed", "in_progress"] },
  }).sort({ start_time: 1 });

  if (!existingBooking) {
    throw new Error("Expected at least one active demo booking");
  }

  const conflictStart = addMinutes(existingBooking.start_time, 15);
  const conflictEnd = addMinutes(conflictStart, 45);

  const conflictResult = await checkBookingConflict({
    stylistId: seeded.profile._id,
    startTime: conflictStart,
    endTime: conflictEnd,
  });

  console.log("[test] Conflict detected:", conflictResult.has_conflict);
  console.log("[test] Suggested slot:", conflictResult.suggestion);

  if (!conflictResult.has_conflict) {
    throw new Error("Expected a stylist booking conflict");
  }

  if (!conflictResult.suggestion?.start_time) {
    throw new Error("Expected a next available slot suggestion");
  }

  const clearResult = await checkBookingConflict({
    stylistId: seeded.profile._id,
    startTime: addMinutes(existingBooking.end_time, 30),
    endTime: addMinutes(existingBooking.end_time, 75),
  });

  if (clearResult.has_conflict) {
    throw new Error("Expected no conflict in a free slot");
  }

  try {
    await assertNoBookingConflict({
      stylistId: seeded.profile._id,
      startTime: conflictStart,
      endTime: conflictEnd,
    });
    throw new Error("assertNoBookingConflict should throw on overlap");
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
