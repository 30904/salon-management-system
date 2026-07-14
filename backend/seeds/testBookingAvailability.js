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
import {
  BLOCKING_STATUSES,
  intervalsOverlap,
} from "../services/bookingConflictService.js";
import { getBookingAvailabilityHandler } from "../controllers/bookingController.js";
import { seedDemoStaffEarnings } from "./demoStaffEarningsSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function request({ query = {} } = {}) {
  return { query };
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

async function run() {
  await connectDB();

  console.log("[test] Booking availability API (Sheet 04 row 6)");

  const seeded = await seedDemoStaffEarnings();
  const stylistId = seeded.profile._id.toString();
  const today = startOfDay(new Date()).toISOString().slice(0, 10);

  const res = mockRes();
  await getBookingAvailabilityHandler(
    request({
      query: {
        stylist_id: stylistId,
        date: today,
        duration_minutes: 45,
      },
    }),
    res
  );

  const { data } = res.body;

  if (!Array.isArray(data.slots)) {
    throw new Error("Expected slots array in availability response");
  }

  if (!data.working_hours?.start || !data.working_hours?.end) {
    throw new Error("Expected working_hours in availability response");
  }

  console.log("[test] GET /bookings/availability slots:", data.slots.length);
  console.log("[test] Booked slots:", data.booked_slots.length);

  for (const slot of data.slots) {
    const slotStart = new Date(slot.start_time);
    const slotEnd = new Date(slot.end_time);

    for (const booked of data.booked_slots) {
      if (!BLOCKING_STATUSES.includes(booked.status)) {
        continue;
      }

      if (
        intervalsOverlap(
          slotStart,
          slotEnd,
          new Date(booked.start_time),
          new Date(booked.end_time)
        )
      ) {
        throw new Error("Free slot overlaps a booked slot");
      }
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = startOfDay(tomorrow).toISOString().slice(0, 10);

  const tomorrowRes = mockRes();
  await getBookingAvailabilityHandler(
    request({
      query: {
        stylist_id: stylistId,
        date: tomorrowStr,
        duration_minutes: 60,
      },
    }),
    tomorrowRes
  );

  console.log(
    "[test] GET /bookings/availability tomorrow:",
    tomorrowRes.body.data.slots.length
  );

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
