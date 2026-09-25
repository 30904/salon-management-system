/**
 * Seed ProductMaster from repo-root SALON INVENTORY LIST.xlsx (client inventory).
 *
 * - Parses the multi-column salon sheet (hair retail / beauty stock & use / hair stock).
 * - Upserts by SKU (INV-*).
 * - Deactivates leftover demo products (SKU PRD-*).
 * - Prices are 0 (not in the sheet) — update later in Inventory UI.
 *
 * Usage:
 *   npm run seed:client-inventory
 *   REPLACE_DEMO=0 npm run seed:client-inventory   # keep demo products active
 */
import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import mongoose from "mongoose";
import ProductMaster from "../models/ProductMaster.js";
import { CLIENT_INVENTORY_FILE } from "../constants/clientInventoryConstants.js";
import { parseClientInventoryWorkbook } from "../services/clientInventoryImportService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_FILE = path.resolve(__dirname, "../../", CLIENT_INVENTORY_FILE);

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
    console.warn("[seed:client-inventory] SRV DNS failed — retrying standard URI…");
    await mongoose.connect(fallback);
    return "standard-fallback";
  }
}

async function upsertProduct(product) {
  const { _source_row, ...payload } = product;
  return ProductMaster.findOneAndUpdate(
    { sku: payload.sku },
    {
      $set: {
        name: payload.name,
        brand: payload.brand,
        category: payload.category,
        stock_type: payload.stock_type,
        unit: payload.unit,
        purchase_price: payload.purchase_price,
        sale_price: payload.sale_price,
        current_stock: payload.current_stock,
        reorder_level: payload.reorder_level,
        is_active: true,
      },
      $setOnInsert: { sku: payload.sku },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in backend/.env");

  if (!fs.existsSync(ROOT_FILE)) {
    throw new Error(
      `Inventory file not found at ${ROOT_FILE}. Place ${CLIENT_INVENTORY_FILE} in the repo root.`
    );
  }

  const mode = await connectMongo(uri);
  console.log(`[seed:client-inventory] Connected (${mode})`);
  console.log(`[seed:client-inventory] File: ${ROOT_FILE}`);

  const beforeCount = await ProductMaster.countDocuments({});
  console.log(`[seed:client-inventory] Products before: ${beforeCount}`);

  const buffer = fs.readFileSync(ROOT_FILE);
  const parsed = parseClientInventoryWorkbook(buffer);

  console.log(
    `[seed:client-inventory] Parsed sheet="${parsed.sheet_name}" products=${parsed.products.length} brand_headers=${parsed.brand_headers.length}`
  );

  const bySection = {};
  for (const p of parsed.products) {
    const key = `${p.category} / ${p.stock_type}`;
    bySection[key] = (bySection[key] || 0) + 1;
  }
  console.log("[seed:client-inventory] By section:", bySection);

  let created = 0;
  let updated = 0;

  for (const product of parsed.products) {
    const existing = await ProductMaster.findOne({ sku: product.sku }).select("_id");
    await upsertProduct(product);
    if (existing) updated += 1;
    else created += 1;
  }

  let demoDeactivated = 0;
  const replaceDemo = process.env.REPLACE_DEMO !== "0";
  if (replaceDemo) {
    const demoResult = await ProductMaster.updateMany(
      { sku: { $regex: /^PRD-/i }, is_active: true },
      { $set: { is_active: false } }
    );
    demoDeactivated = demoResult.modifiedCount || 0;
  }

  const afterCount = await ProductMaster.countDocuments({});
  const activeCount = await ProductMaster.countDocuments({ is_active: true });
  const clientActive = await ProductMaster.countDocuments({
    is_active: true,
    sku: { $regex: /^INV-/i },
  });

  console.log("[seed:client-inventory] Summary:");
  console.log(`  created           = ${created}`);
  console.log(`  updated           = ${updated}`);
  console.log(`  demo_deactivated  = ${demoDeactivated}`);
  console.log(`  products_total    = ${afterCount}`);
  console.log(`  products_active   = ${activeCount}`);
  console.log(`  client_inv_active = ${clientActive}`);
  console.log(
    "[seed:client-inventory] Note: purchase_price/sale_price set to 0 (not in Excel) — update in Inventory UI when known."
  );
  console.log("[seed:client-inventory] Done.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[seed:client-inventory] Failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
