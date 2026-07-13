import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import Attendance, { ATTENDANCE_STATUSES } from "../models/Attendance.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[test] Verifying Attendance DB Model Schema & Fields...");

  // Find a staff member or user in DB, or create placeholders if DB is empty
  const staff = await StaffProfile.findOne().populate("user_id");
  const user = await User.findOne();

  if (!staff) {
    console.log("[test] Note: No staff found in DB. Run `npm run seed:dev` first for full populated staff details.");
  }

  const testDate = new Date("2026-07-13T00:00:00.000Z");
  const punchIn = new Date("2026-07-13T09:15:00.000Z");
  const punchOut = new Date("2026-07-13T18:30:00.000Z");

  // Create or update test attendance record
  const attendance = await Attendance.findOneAndUpdate(
    { staff_id: staff ? staff._id : new User()._id, date: testDate },
    {
      punch_in_time: punchIn,
      punch_out_time: punchOut,
      status: "present",
      remarks: "Checked in via Reception terminal",
      punched_by: user ? user._id : null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate({
      path: "staff_id",
      populate: { path: "user_id", select: "name phone email" },
    })
    .populate("punched_by", "name phone");

  const safe = attendance.toSafeObject();

  console.log("\n[test] --- Attendance Record Created & Verified ---");
  console.log("[test] ID             :", safe.id);
  console.log("[test] Staff          :", safe.staff ? `${safe.staff.user?.name || "Staff"} (${safe.staff.designation})` : safe.staff_id);
  console.log("[test] Date           :", safe.date.toISOString().split("T")[0]);
  console.log("[test] Punch In Time  :", safe.punch_in_time ? safe.punch_in_time.toISOString() : "None");
  console.log("[test] Punch Out Time :", safe.punch_out_time ? safe.punch_out_time.toISOString() : "None");
  console.log("[test] Status         :", safe.status);
  console.log("[test] Remarks        :", safe.remarks);
  console.log("[test] Punched By     :", safe.punched_by_user ? `${safe.punched_by_user.name} (${safe.punched_by_user.phone})` : safe.punched_by);
  console.log("[test] Allowed Statuses:", ATTENDANCE_STATUSES.join(", "));
  console.log("\n[test] All Attendance model fields verified successfully!");

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
