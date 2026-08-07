/**
 * Sync salon employee salaries + monthly sales targets from client sheet.
 *
 * Pattern used by salon: Target 1 = 5× salary, Target 2 = 7× salary.
 * Sarang listed as 3,20,000 in the sheet — that matches 32,000 × 5 / × 7,
 * so we store salary as 32,000.
 *
 * Usage:
 *   node seeds/syncStaffTargetsSeed.js
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import StaffProfile from "../models/StaffProfile.js";
import "../models/User.js";

// Node on some Windows ISP DNS setups fails querySrv for mongodb+srv.
// Prefer public DNS for this process so Atlas SRV lookup works.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore if platform blocks overriding DNS
}

const STAFF_TARGETS = [
  {
    matchNames: ["sarang"],
    base_salary: 32000,
    monthly_target_1: 160000,
    monthly_target_2: 224000,
  },
  {
    matchNames: ["sai"],
    base_salary: 22000,
    monthly_target_1: 110000,
    monthly_target_2: 154000,
  },
  {
    matchNames: ["sujit", "sujith"],
    base_salary: 17000,
    monthly_target_1: 85000,
    monthly_target_2: 119000,
  },
  {
    matchNames: ["shruti"],
    base_salary: 17000,
    monthly_target_1: 85000,
    monthly_target_2: 119000,
  },
  {
    matchNames: ["mahi"],
    base_salary: 15000,
    monthly_target_1: 75000,
    monthly_target_2: 105000,
  },
  {
    matchNames: ["neha"],
    base_salary: 12000,
    monthly_target_1: 60000,
    monthly_target_2: 84000,
  },
  {
    matchNames: ["mansi"],
    base_salary: 12000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
  {
    matchNames: ["khushi"],
    base_salary: 10000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
  {
    matchNames: ["rabiya"],
    base_salary: 10000,
    monthly_target_1: 0,
    monthly_target_2: 0,
  },
];

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findConfigForUser(userName) {
  const name = normalizeName(userName);
  if (!name) return null;

  const tokens = name.split(" ").filter(Boolean);

  return STAFF_TARGETS.find((row) =>
    row.matchNames.some((token) => {
      const needle = normalizeName(token);
      // Match full name or a whole name token (avoid "sai" matching "Desai")
      return name === needle || tokens.includes(needle) || name.startsWith(`${needle} `);
    })
  );
}

/**
 * Convert mongodb+srv URI to a standard host-list URI when SRV DNS fails.
 * Hosts discovered via SRV for this Atlas cluster.
 */
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
    return { mode: "primary" };
  } catch (error) {
    if (!String(uri).startsWith("mongodb+srv://")) throw error;
    if (!String(error.message || "").includes("querySrv")) throw error;

    const fallback = toStandardMongoUri(uri);
    if (!fallback) throw error;

    console.warn("[targets] SRV DNS failed — retrying with standard Mongo URI…");
    await mongoose.connect(fallback);
    return { mode: "standard-fallback" };
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  const connected = await connectMongo(uri);
  console.log(`[targets] Connected (${connected.mode})`);

  const profiles = await StaffProfile.find({ is_active: true }).populate(
    "user_id",
    "name phone"
  );

  let updated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const userName = profile.user_id?.name;
    const config = findConfigForUser(userName);
    if (!config) {
      console.log(`[targets] skip (no match): ${userName || profile._id}`);
      skipped += 1;
      continue;
    }

    profile.base_salary = config.base_salary;
    profile.monthly_target_1 = config.monthly_target_1;
    profile.monthly_target_2 = config.monthly_target_2;
    await profile.save();

    console.log(
      `[targets] updated ${userName}: salary=${config.base_salary}, T1=${config.monthly_target_1}, T2=${config.monthly_target_2}`
    );
    updated += 1;
  }

  console.log(`[targets] Done. updated=${updated}, skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[targets] Failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
