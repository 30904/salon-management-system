import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/Booking.js";
import "../models/CommissionEntry.js";
import User from "../models/User.js";
import { getMyCalendarHandler } from "../controllers/staffCalendarController.js";
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

async function run() {
  await connectDB();

  console.log("[test] Staff calendar API (Sheet 02 row 22)");

  const seeded = await seedDemoStaffEarnings();
  const stylist = await User.findById(seeded.user._id).populate("role_id");

  const req = {
    user: stylist,
    permissions: [],
    query: {},
  };

  const res = mockRes();
  await getMyCalendarHandler(req, res);

  console.log("[test] GET /staff/me/calendar bookings:", res.body.data.bookings.length);
  console.log("[test] Upcoming bookings:", res.body.data.summary.upcoming);
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
