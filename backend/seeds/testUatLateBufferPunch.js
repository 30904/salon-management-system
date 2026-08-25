/**
 * UAT (Pending tracker 01 Late-Buffer row 14):
 * Owner sets per-stylist late buffers; punch status matches each buffer on the
 * NEXT punch only — changing the buffer mid-month does not rewrite past Attendance.
 *
 * Usage:
 *   npm run test:uat-late-buffer-punch
 */
import dns from "node:dns";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import "../models/ShiftMaster.js";
import Role, { ROLE_NAMES } from "../models/Role.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import ShiftMaster from "../models/ShiftMaster.js";
import Attendance from "../models/Attendance.js";
import { hashPassword } from "../services/userService.js";
import { resolvePunchInStatus } from "../services/attendancePunchService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const PHONES = ["9800001401", "9800001402", "9800001403"];
const SHIFT_NAME = "UAT_LATE_BUFFER_SHIFT";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  PASS: ${label}`);
}

function kolkataInstant({ year, month, day, hour, minute }) {
  const utcMs = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMs);
}

async function cleanup() {
  const users = await User.find({ phone: { $in: PHONES } }).select("_id");
  const userIds = users.map((u) => u._id);
  const profiles = await StaffProfile.find({ user_id: { $in: userIds } }).select("_id");
  const profileIds = profiles.map((p) => p._id);

  if (profileIds.length) {
    await Attendance.deleteMany({ staff_id: { $in: profileIds } });
    await StaffProfile.deleteMany({ _id: { $in: profileIds } });
  }
  if (userIds.length) {
    await User.deleteMany({ _id: { $in: userIds } });
  }
  await ShiftMaster.deleteMany({ name: SHIFT_NAME });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  await mongoose.connect(uri);
  console.log("[test] UAT — per-staff late buffer punch (next punch only)\n");

  await cleanup();

  const role =
    (await Role.findOne({ name: ROLE_NAMES.STYLIST })) || (await Role.findOne());
  if (!role) throw new Error("No role found — run seed:roles first");

  const shift = await ShiftMaster.create({
    name: SHIFT_NAME,
    start_time: "10:00",
    end_time: "19:00",
    is_active: true,
  });

  const password_hash = await hashPassword("Test@123");
  const buffers = [5, 15, null];
  const labels = ["A", "B", "C"];
  const staffRows = [];

  for (let i = 0; i < 3; i += 1) {
    const user = await User.create({
      name: `UAT Late Buffer ${labels[i]}`,
      phone: PHONES[i],
      email: `${PHONES[i]}@uat-late-buffer.test`,
      password_hash,
      role_id: role._id,
      is_active: true,
    });
    const profile = await StaffProfile.create({
      user_id: user._id,
      designation: `UAT Stylist ${labels[i]}`,
      shift_id: shift._id,
      late_mark_buffer_minutes: buffers[i],
      weekly_off_day: 1,
      base_salary: 20000,
      is_active: true,
    });
    staffRows.push({ label: labels[i], buffer: buffers[i], profile });
  }

  const punchPlus7 = kolkataInstant({
    year: 2026,
    month: 8,
    day: 13,
    hour: 10,
    minute: 7,
  });

  const expected = { A: "late", B: "present", C: "present" };

  for (const row of staffRows) {
    const status = await resolvePunchInStatus({
      targetStaff: row.profile,
      punchInDate: punchPlus7,
    });
    assertEq(
      status,
      expected[row.label],
      `Staff ${row.label} (buffer ${row.buffer ?? "blank"}) at shift+7 → ${expected[row.label]}`
    );
  }

  // Persist Staff A's late punch, then mid-month change buffer 5 → 15
  console.log("\n[test] Mid-month buffer change is not retroactive\n");

  const staffA = staffRows[0].profile;
  const attendDate = new Date(Date.UTC(2026, 7, 13));
  const saved = await Attendance.create({
    staff_id: staffA._id,
    date: attendDate,
    punch_in_time: punchPlus7,
    status: "late",
    remarks: "UAT late buffer punch",
  });
  assertEq(saved.status, "late", "stored Attendance for Staff A is late");

  staffA.late_mark_buffer_minutes = 15;
  await staffA.save();

  const reloaded = await Attendance.findById(saved._id);
  assertEq(
    reloaded.status,
    "late",
    "past Attendance stays late after buffer change (not retroactive)"
  );

  const nextPunchStatus = await resolvePunchInStatus({
    targetStaff: staffA,
    punchInDate: punchPlus7,
  });
  assertEq(
    nextPunchStatus,
    "present",
    "next resolve with buffer 15 at shift+7 is present"
  );

  await cleanup();
  await mongoose.connection.close();
  console.log("\n[test] UAT late buffer punch passed");
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message || err);
  try {
    await cleanup();
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
