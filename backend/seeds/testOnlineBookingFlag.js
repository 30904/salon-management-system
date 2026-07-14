import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import { getBookingFeatureFlags } from "../config/featureFlags.js";
import "../models/Role.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/Customer.js";
import "../models/ServiceMaster.js";
import "../models/ShiftMaster.js";
import "../models/Booking.js";
import { getBookingFeatureFlagsHandler } from "../controllers/bookingController.js";
import { createBooking } from "../services/bookingService.js";
import { AppError } from "../utils/AppError.js";
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

function request({ body = {}, user = null } = {}) {
  return { body, user };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function run() {
  await connectDB();

  console.log("[test] Online booking flag (Sheet 04 row 12)");

  const flags = getBookingFeatureFlags();

  if (flags.online_booking_enabled) {
    throw new Error("Expected online_booking_enabled=false in Phase 1");
  }

  if (!flags.allowed_booking_sources.includes("internal")) {
    throw new Error("Expected internal source to remain allowed");
  }

  if (flags.allowed_booking_sources.includes("online")) {
    throw new Error("Expected online source to be blocked in Phase 1");
  }

  const flagRes = mockRes();
  await getBookingFeatureFlagsHandler(request(), flagRes);
  console.log(
    "[test] GET /bookings/feature-flags:",
    flagRes.body.data.online_booking_phase
  );

  const seeded = await seedDemoStaffEarnings();
  const demoBooking = seeded.bookings[0];
  const customerId = demoBooking.customer_id.toString();
  const stylistId = seeded.profile._id.toString();
  const serviceIds = demoBooking.service_ids.map((id) => id.toString());

  const lastBooking = seeded.bookings[seeded.bookings.length - 1];
  const startTime = addMinutes(lastBooking.end_time, 120);
  const endTime = addMinutes(startTime, 45);

  let blocked = false;

  try {
    await createBooking(
      {
        customer_id: customerId,
        stylist_id: stylistId,
        service_ids: serviceIds.slice(0, 1),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        source: "online",
      },
      { userId: seeded.user._id }
    );
  } catch (error) {
    blocked = error instanceof AppError && error.statusCode === 403;
  }

  console.log("[test] POST /bookings source=online blocked:", blocked);

  if (!blocked) {
    throw new Error("Expected online booking create to be rejected in Phase 1");
  }

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
