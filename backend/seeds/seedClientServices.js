/**
 * Seed ServiceCategory + ServiceMaster from Salon 21 rate cards (men + women + nails).
 *
 * Upserts by (category name + service name). Deactivates leftover non-catalog services
 * (e.g. incomplete manual entries) unless KEEP_OTHER_SERVICES=1.
 *
 * Usage:
 *   npm run seed:client-services
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";
import {
  CLIENT_SERVICE_CATEGORIES,
  CLIENT_SERVICES,
} from "../constants/clientServicesCatalog.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

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
    console.warn("[seed:client-services] SRV DNS failed — retrying standard URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function upsertCategory(name) {
  return ServiceCategory.findOneAndUpdate(
    { name },
    { name, is_active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertService(categoryId, service) {
  const existing = await ServiceMaster.findOne({
    category_id: categoryId,
    name: service.name,
  }).select("_id");

  await ServiceMaster.findOneAndUpdate(
    { category_id: categoryId, name: service.name },
    {
      category_id: categoryId,
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: service.price,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return existing ? "updated" : "created";
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  const mode = await connectMongo(uri);
  console.log(`[seed:client-services] Connected (${mode})`);
  console.log(
    `[seed:client-services] Catalog: ${CLIENT_SERVICE_CATEGORIES.length} categories, ${CLIENT_SERVICES.length} services`
  );

  const categoryByName = new Map();
  for (const name of CLIENT_SERVICE_CATEGORIES) {
    const category = await upsertCategory(name);
    categoryByName.set(name, category);
  }

  let created = 0;
  let updated = 0;
  const seededIds = [];

  for (const service of CLIENT_SERVICES) {
    const category = categoryByName.get(service.category);
    if (!category) {
      throw new Error(`Missing category in catalog map: ${service.category}`);
    }
    const result = await upsertService(category._id, service);
    if (result === "created") created += 1;
    else updated += 1;

    const doc = await ServiceMaster.findOne({
      category_id: category._id,
      name: service.name,
    }).select("_id");
    if (doc) seededIds.push(doc._id);
  }

  // Deactivate leftover non-catalog services (incomplete manual entries, etc.)
  let deactivatedOther = 0;
  if (process.env.KEEP_OTHER_SERVICES !== "1" && seededIds.length) {
    const deact = await ServiceMaster.updateMany(
      { _id: { $nin: seededIds }, is_active: true },
      { $set: { is_active: false } }
    );
    deactivatedOther = deact.modifiedCount || 0;
  }

  // Deactivate categories with no active services (old demo leftovers).
  const keepCategoryNames = new Set(CLIENT_SERVICE_CATEGORIES);
  let deactivatedCategories = 0;
  const otherCats = await ServiceCategory.find({
    name: { $nin: [...keepCategoryNames] },
    is_active: true,
  }).select("_id name");
  for (const cat of otherCats) {
    const inUse = await ServiceMaster.countDocuments({
      category_id: cat._id,
      is_active: true,
    });
    if (inUse === 0) {
      await ServiceCategory.updateOne({ _id: cat._id }, { $set: { is_active: false } });
      deactivatedCategories += 1;
    }
  }

  const byCategory = {};
  for (const s of CLIENT_SERVICES) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  }

  console.log("[seed:client-services] Summary:");
  console.log(`  categories_upserted = ${CLIENT_SERVICE_CATEGORIES.length}`);
  console.log(`  services_created    = ${created}`);
  console.log(`  services_updated    = ${updated}`);
  console.log(`  other_deactivated   = ${deactivatedOther}`);
  console.log(`  empty_cats_off      = ${deactivatedCategories}`);
  console.log(
    `  active_services     = ${await ServiceMaster.countDocuments({ is_active: true })}`
  );
  console.log(
    `  active_categories   = ${await ServiceCategory.countDocuments({ is_active: true })}`
  );
  console.log("[seed:client-services] Counts by category:");
  for (const [name, count] of Object.entries(byCategory)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log("[seed:client-services] Done.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed:client-services] Failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
