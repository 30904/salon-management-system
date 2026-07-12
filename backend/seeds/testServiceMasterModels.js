import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[test] Service master models (Sheet 03 row 3)");

  const category = await ServiceCategory.findOneAndUpdate(
    { name: "Model Test Hair" },
    { name: "Model Test Hair", is_active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const service = await ServiceMaster.findOneAndUpdate(
    { category_id: category._id, name: "Model Test Cut" },
    {
      category_id: category._id,
      name: "Model Test Cut",
      duration_minutes: 30,
      price: 499,
      commission_slab_override_id: null,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const populated = await ServiceMaster.populateForList(
    ServiceMaster.findById(service._id)
  );
  const hydrated = await populated;
  const safe = hydrated.toSafeObject();

  console.log("[test] Category fields:", category.name, category.is_active);
  console.log(
    "[test] Service fields:",
    safe.name,
    safe.duration_minutes,
    safe.price,
    safe.commission_slab_override_id,
    safe.is_active
  );
  console.log("[test] Populated category:", safe.category?.name);
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
