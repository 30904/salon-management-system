import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/CommissionEntry.js";
import User from "../models/User.js";
import { getMyEarningsHandler } from "../controllers/staffEarningsController.js";
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

  console.log("[test] Staff earnings API (Sheet 02 row 23)");

  const seeded = await seedDemoStaffEarnings();
  const stylist = await User.findById(seeded.user._id).populate("role_id");

  const req = {
    user: stylist,
    permissions: [],
    query: {},
  };

  const res = mockRes();
  await getMyEarningsHandler(req, res);

  console.log("[test] GET /staff/me/earnings entries:", res.body.data.entries.length);
  console.log(
    "[test] Commission total:",
    res.body.data.summary.commission_total
  );
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
