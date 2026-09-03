/**
 * Wipe demo users/staff and seed real S21 salon employees.
 *
 * Keeps Owner: 9137045588 / Owner@123
 * Deletes all other users + their staff profiles.
 * Creates the real salon staff with salary + monthly targets.
 *
 * Usage:
 *   npm run seed:real-staff
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import Role, { ROLE_NAMES } from "../models/Role.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import ShiftMaster from "../models/ShiftMaster.js";
import CommissionSlab from "../models/CommissionSlab.js";
import CommissionEntry from "../models/CommissionEntry.js";
import Booking from "../models/Booking.js";
import Attendance from "../models/Attendance.js";
import { hashPassword } from "../services/userService.js";
import { seedDefaultBranch } from "./branchSeed.js";
import { getDevOwnerConfig, seedDevOwner } from "./ownerUserSeed.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const REAL_STAFF = [
  {
    name: "Sarang Devkar",
    phone: "9975117488",
    password: "sarang@123",
    email: "sarang@s21.com",
    designation: "Senior Stylist",
    specialization: ["hair", "bridal"],
    base_salary: 32000,
    monthly_target_1: 160000,
    monthly_target_2: 224000,
  },
  {
    name: "Sai Jadav",
    phone: "9619350567",
    password: "sai@123",
    email: "sai@s21.com",
    designation: "Junior Stylist",
    specialization: ["hair"],
    base_salary: 22000,
    monthly_target_1: 110000,
    monthly_target_2: 154000,
  },
  {
    name: "Sujit Thakur",
    phone: "9113159824",
    password: "sujit@123",
    email: "sujit@s21.com",
    designation: "Stylist",
    specialization: ["hair"],
    base_salary: 17000,
    monthly_target_1: 85000,
    monthly_target_2: 119000,
  },
  {
    name: "Shruti Urao",
    phone: "8454837801",
    password: "shruti@123",
    email: "shruti@s21.com",
    designation: "Senior Beautician",
    specialization: ["facial", "skin"],
    base_salary: 17000,
    monthly_target_1: 85000,
    monthly_target_2: 119000,
  },
  {
    name: "Mahi Thasal",
    phone: "7045414880",
    password: "mahi@123",
    email: "mahi@s21.com",
    designation: "Junior Beautician",
    specialization: ["facial", "skin"],
    base_salary: 15000,
    monthly_target_1: 75000,
    monthly_target_2: 105000,
  },
  {
    name: "Neha Kadola",
    phone: "9967162839",
    password: "neha@123",
    email: "neha@s21.com",
    designation: "Beautician",
    specialization: ["facial", "skin"],
    base_salary: 12000,
    monthly_target_1: 60000,
    monthly_target_2: 84000,
  },
  {
    name: "Mansi Govalkar",
    phone: "8999592723",
    password: "mansi@123",
    email: "mansi@s21.com",
    designation: "Front Manager",
    specialization: ["front-desk"],
    base_salary: 12000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
  {
    name: "Khushi Shaikh",
    phone: "8108879638",
    password: "khushi@123",
    email: "khushi@s21.com",
    designation: "Housekeeping",
    specialization: ["housekeeping"],
    base_salary: 10000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
  {
    name: "Rabiya Shaikh",
    phone: "8419920563",
    password: "rabiya@123",
    email: "rabiya@s21.com",
    designation: "Housekeeping",
    specialization: ["housekeeping"],
    base_salary: 10000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
  {
    name: "Raksha Magar",
    phone: "9892744709",
    password: "raksha@123",
    email: "raksha@s21.com",
    designation: "Stylist",
    specialization: ["hair"],
    base_salary: 17000,
    monthly_target_1: 85000,
    monthly_target_2: 119000,
  },
];

function toStandardMongoUri(srvUri) {
  const match = String(srvUri || "").match(
    /^mongodb\+srv:\/\/([^@]+)@([^/]+)\/([^?]+)?(\?.*)?$/i
  );
  if (!match) return null;

  const [, auth, , dbName = "s21management", query = ""] = match;
  const hosts = [
    "ac-vlysbzs-shard-00-00.uftuzf3.mongodb.net:27017",
    "ac-vlysbzs-shard-00-01.uftuzf3.mongodb.net:27017",
    "ac-vlysbzs-shard-00-02.uftuzf3.mongodb.net:27017",
  ].join(",");

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  params.set("ssl", "true");
  params.set("authSource", params.get("authSource") || "admin");
  params.set("retryWrites", params.get("retryWrites") || "true");
  params.set("w", params.get("w") || "majority");

  return `mongodb://${auth}@${hosts}/${dbName}?${params.toString()}`;
}

async function connectMongo(uri) {
  try {
    await mongoose.connect(uri);
    return "primary";
  } catch (error) {
    if (!String(uri).startsWith("mongodb+srv://")) throw error;
    if (!String(error.message || "").includes("querySrv")) throw error;
    const fallback = toStandardMongoUri(uri);
    if (!fallback) throw error;
    console.warn("[real-staff] SRV DNS failed — retrying with standard Mongo URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function ensureGeneralShift(branchId) {
  return ShiftMaster.findOneAndUpdate(
    { branch_id: branchId, name: "General Shift" },
    {
      name: "General Shift",
      start_time: "10:00",
      end_time: "19:00",
      branch_id: branchId,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function resolveCommissionSlab() {
  const existing = await CommissionSlab.findOne({ is_active: true }).sort({ createdAt: 1 });
  if (existing) return existing;

  return CommissionSlab.create({
    name: "Default 10% Service Slab",
    type: "percentage",
    rules_json: { rate: 10 },
    is_active: true,
  });
}

async function deleteStaffProfilesByIds(profileIds, label = "profile") {
  if (profileIds.length === 0) return 0;

  await Promise.all([
    CommissionEntry.deleteMany({ staff_id: { $in: profileIds } }),
    Booking.deleteMany({ stylist_id: { $in: profileIds } }),
    Attendance.deleteMany({ staff_id: { $in: profileIds } }),
    StaffProfile.deleteMany({ _id: { $in: profileIds } }),
  ]);

  return profileIds.length;
}

async function wipeOrphanStaffProfiles() {
  const profiles = await StaffProfile.find({}).select("_id user_id designation");
  if (profiles.length === 0) {
    console.log("[real-staff] No orphan staff profiles to delete");
    return { deletedProfiles: 0 };
  }

  const userIds = profiles.map((p) => p.user_id).filter(Boolean);
  const existingUsers = await User.find({ _id: { $in: userIds } }).select("_id");
  const existingIds = new Set(existingUsers.map((u) => String(u._id)));

  const orphans = profiles.filter((p) => !p.user_id || !existingIds.has(String(p.user_id)));
  const profileIds = orphans.map((p) => p._id);

  if (profileIds.length === 0) {
    console.log("[real-staff] No orphan staff profiles to delete");
    return { deletedProfiles: 0 };
  }

  await deleteStaffProfilesByIds(profileIds);

  for (const profile of orphans) {
    console.log(
      `[real-staff] deleted orphan profile: ${profile.designation || "—"} (${profile._id})`
    );
  }

  return { deletedProfiles: profileIds.length };
}

async function wipeNonOwnerUsers(ownerPhone) {
  const keepPhones = new Set([ownerPhone, ...REAL_STAFF.map((s) => s.phone)]);
  const keepEmails = new Set(REAL_STAFF.map((s) => s.email.toLowerCase()));

  const allUsers = await User.find({}).select("_id phone name email");
  const toDelete = allUsers.filter((user) => {
    const phone = String(user.phone || "").trim();
    if (phone && keepPhones.has(phone)) return false;
    return true;
  });
  const deleteIds = toDelete.map((u) => u._id);

  if (deleteIds.length === 0) {
    console.log("[real-staff] No demo users to delete");
    return { deletedUsers: 0, deletedProfiles: 0 };
  }

  const profiles = await StaffProfile.find({ user_id: { $in: deleteIds } }).select("_id");
  const profileIds = profiles.map((p) => p._id);

  if (profileIds.length > 0) {
    await deleteStaffProfilesByIds(profileIds);
  }

  const userDelete = await User.deleteMany({ _id: { $in: deleteIds } });

  // Clear email collisions on kept users (e.g. old owner@salon.dev on a different doc)
  const ownerConfig = getDevOwnerConfig();
  await User.updateMany(
    {
      phone: { $ne: ownerPhone },
      email: ownerConfig.email,
    },
    { $unset: { email: 1 } }
  );
  for (const email of keepEmails) {
    await User.updateMany(
      {
        phone: { $nin: [...keepPhones] },
        email,
      },
      { $unset: { email: 1 } }
    );
  }

  for (const user of toDelete) {
    console.log(
      `[real-staff] deleted user: ${user.name || "—"} (${user.phone || "no-phone"} / ${user.email || "no-email"})`
    );
  }

  return {
    deletedUsers: userDelete.deletedCount || 0,
    deletedProfiles: profileIds.length,
  };
}

async function upsertRealStaff({ stylistRole, branch, shift, slab, ownerId }) {
  const created = [];

  for (const row of REAL_STAFF) {
    const password_hash = await hashPassword(row.password);

    const user = await User.findOneAndUpdate(
      { phone: row.phone },
      {
        name: row.name,
        phone: row.phone,
        email: row.email,
        password_hash,
        role_id: stylistRole._id,
        branch_id: branch._id,
        is_active: true,
        created_by: ownerId || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const profile = await StaffProfile.findOneAndUpdate(
      { user_id: user._id },
      {
        user_id: user._id,
        designation: row.designation,
        specialization: row.specialization,
        commission_slab_id: slab?._id || null,
        base_salary: row.base_salary,
        monthly_target_1: row.monthly_target_1,
        monthly_target_2: row.monthly_target_2,
        shift_id: shift?._id || null,
        joining_date: new Date(),
        is_active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    created.push({
      name: user.name,
      phone: user.phone,
      password: row.password,
      designation: profile.designation,
      salary: profile.base_salary,
      t1: profile.monthly_target_1,
      t2: profile.monthly_target_2,
    });

    console.log(
      `[real-staff] upserted ${user.name} | ${user.phone} | ${row.designation} | salary=${row.base_salary}`
    );
  }

  return created;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  const mode = await connectMongo(uri);
  console.log(`[real-staff] Connected (${mode})`);

  const ownerConfig = getDevOwnerConfig();

  // Wipe demos first so owner email / phone upserts don't hit unique-index conflicts
  const wiped = await wipeNonOwnerUsers(ownerConfig.phone);
  console.log(
    `[real-staff] Wipe done: users=${wiped.deletedUsers}, profiles=${wiped.deletedProfiles}`
  );

  const orphanWipe = await wipeOrphanStaffProfiles();
  console.log(`[real-staff] Orphan cleanup: profiles=${orphanWipe.deletedProfiles}`);

  const { branch, user: owner } = await seedDevOwner();
  console.log(`[real-staff] Owner kept: ${owner.name} (${owner.phone})`);

  const stylistRole = await Role.findOne({ name: ROLE_NAMES.STYLIST });
  if (!stylistRole) {
    throw new Error("Stylist role missing — run npm run seed:roles (or seed:dev) first");
  }

  const shift = await ensureGeneralShift(branch._id);
  const slab = await resolveCommissionSlab();
  console.log(`[real-staff] Shift: ${shift.name} | Slab: ${slab.name}`);

  const staff = await upsertRealStaff({
    stylistRole,
    branch,
    shift,
    slab,
    ownerId: owner._id,
  });

  console.log("\n[real-staff] Login credentials:");
  console.log(`  Owner | ${ownerConfig.phone} | ${ownerConfig.password}`);
  for (const row of staff) {
    console.log(`  ${row.name} | ${row.phone} | ${row.password}`);
  }

  console.log(`\n[real-staff] Done. staff_count=${staff.length}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[real-staff] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
