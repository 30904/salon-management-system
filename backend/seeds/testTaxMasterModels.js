import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import TaxMaster, { TAX_APPLIES_TO } from "../models/TaxMaster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[test] Tax master model (Sheet 03 row 9)");
  console.log("[test] applies_to values:", TAX_APPLIES_TO.join(", "));

  const serviceTax = await TaxMaster.findOneAndUpdate(
    { name: "Model Test GST Services" },
    {
      name: "Model Test GST Services",
      rate: 18,
      applies_to: "service",
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const productTax = await TaxMaster.findOneAndUpdate(
    { name: "Model Test GST Products" },
    {
      name: "Model Test GST Products",
      rate: 12,
      applies_to: "product",
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const safe = serviceTax.toSafeObject();

  console.log("[test] Tax fields:", safe.name, safe.rate, safe.applies_to, safe.is_active);
  console.log(
    "[test] Service tax filter count:",
    await TaxMaster.countDocuments(TaxMaster.appliesToFilter("service"))
  );
  console.log(
    "[test] Product tax filter count:",
    await TaxMaster.countDocuments(TaxMaster.appliesToFilter("product"))
  );
  console.log("[test] Product tax rate:", productTax.rate);
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
