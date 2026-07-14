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
  cancelBookingHandler,
  createBookingHandler,
  getBookingHandler,
  listBookingsHandler,
  updateBookingHandler,
  updateBookingStatusHandler,
} from "../controllers/bookingController.js";
import {
  checkBookingConflict,
} from "../services/bookingConflictService.js";
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

function request({ body = {}, params = {}, query = {}, user = null } = {}) {
  return { body, params, query, user };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function run() {
  await connectDB();

  console.log("[test] Booking CRUD API (Sheet 04 row 5)");

  const seeded = await seedDemoStaffEarnings();
  const stylistId = seeded.profile._id.toString();

  const lastBooking = await Booking.findOne({ stylist_id: seeded.profile._id }).sort({
    start_time: -1,
  });

  const startTime = addMinutes(lastBooking.end_time, 60);
  const endTime = addMinutes(startTime, 45);

  const demoCustomer = await Booking.findOne({ stylist_id: seeded.profile._id })
    .populate("customer_id")
    .lean();
  const customerId = demoCustomer.customer_id._id.toString();

  const serviceBooking = await Booking.findOne({ stylist_id: seeded.profile._id })
    .populate("service_ids")
    .lean();
  const serviceIds = serviceBooking.service_ids.map((service) => service._id.toString());

  let bookingId;
  let walkInId;

  try {
    const createRes = mockRes();
    await createBookingHandler(
      request({
        body: {
          customer_id: customerId,
          stylist_id: stylistId,
          service_ids: serviceIds.slice(0, 1),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: "CRUD test booking",
        },
        user: { _id: seeded.user._id },
      }),
      createRes
    );

    if (createRes.statusCode !== 201) {
      throw new Error(`Expected 201 on create, got ${createRes.statusCode}`);
    }

    bookingId = createRes.body.data.id.toString();
    console.log("[test] POST /bookings:", createRes.body.data.status);

    const walkInStart = new Date();
    const walkInEnd = addMinutes(walkInStart, 45);
    const walkInConflict = await checkBookingConflict({
      stylistId: seeded.profile._id,
      startTime: walkInStart,
      endTime: walkInEnd,
    });

    if (walkInConflict.has_conflict) {
      console.log("[test] POST /bookings walk-in: skipped (stylist busy now)");
    } else {
      const walkInRes = mockRes();
      await createBookingHandler(
        request({
          body: {
            customer_id: customerId,
            stylist_id: stylistId,
            service_ids: serviceIds.slice(0, 1),
            walk_in: true,
            notes: "Walk-in CRUD test",
          },
          user: { _id: seeded.user._id },
        }),
        walkInRes
      );

      walkInId = walkInRes.body.data.id.toString();
      const walkInStartMs = new Date(walkInRes.body.data.start_time).getTime();
      const now = Date.now();

      if (Math.abs(walkInStartMs - now) > 2 * 60 * 1000) {
        throw new Error("Walk-in start_time should be near now");
      }

      if (walkInRes.body.data.status !== "booked") {
        throw new Error("Walk-in booking should start as booked");
      }

      console.log("[test] POST /bookings walk-in:", walkInRes.body.data.status);
    }

    const listRes = mockRes();
    await listBookingsHandler(
      request({
        query: {
          stylist_id: stylistId,
          date: startTime.toISOString().slice(0, 10),
        },
      }),
      listRes
    );
    console.log("[test] GET /bookings:", listRes.body.data.length);

    const statusRes = mockRes();
    await updateBookingStatusHandler(
      request({
        params: { id: bookingId },
        body: { status: "confirmed" },
      }),
      statusRes
    );
    console.log("[test] PATCH /bookings/:id/status:", statusRes.body.data.status);

    const updateRes = mockRes();
    await updateBookingHandler(
      request({
        params: { id: bookingId },
        body: { notes: "Updated from CRUD test" },
      }),
      updateRes
    );
    console.log("[test] PATCH /bookings/:id notes:", updateRes.body.data.notes);

    const getRes = mockRes();
    await getBookingHandler(request({ params: { id: bookingId } }), getRes);
    console.log("[test] GET /bookings/:id:", getRes.body.data.customer_name);

    const cancelRes = mockRes();
    await cancelBookingHandler(request({ params: { id: bookingId } }), cancelRes);
    console.log("[test] DELETE /bookings/:id:", cancelRes.body.data.status);

    console.log("[test] Done");
  } finally {
    const ids = [bookingId, walkInId].filter(Boolean);
    if (ids.length) {
      await Booking.deleteMany({ _id: { $in: ids } });
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
