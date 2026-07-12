import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import ProductMaster from "../models/ProductMaster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[test] Product master model (Sheet 03 row 6)");

  const product = await ProductMaster.findOneAndUpdate(
    { sku: "MODEL-TEST-001" },
    {
      name: "Model Test Shampoo",
      sku: "model-test-001",
      unit: "bottle",
      purchase_price: 120,
      sale_price: 249,
      current_stock: 3,
      reorder_level: 5,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const safe = product.toSafeObject();

  console.log("[test] Product fields:", safe.name, safe.sku, safe.unit);
  console.log(
    "[test] Pricing/stock:",
    safe.purchase_price,
    safe.sale_price,
    safe.current_stock,
    safe.reorder_level,
    safe.is_active
  );
  console.log("[test] is_low_stock:", safe.is_low_stock);
  console.log(
    "[test] lowStockFilter count:",
    await ProductMaster.countDocuments(ProductMaster.lowStockFilter())
  );
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
