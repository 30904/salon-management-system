import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/ServiceCategory.js";
import "../models/ServiceMaster.js";
import "../models/ProductMaster.js";
import { seedDemoData } from "./demoDataSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[seed] Demo data (row 25) — services, products, staff stub");
  const result = await seedDemoData();

  console.log("[seed] Service categories:", result.counts.categories);
  console.log("[seed] Services:", result.counts.services);
  console.log("[seed] Products:", result.counts.products);

  if (result.staffShifts.skipped) {
    console.log("[seed] Staff/shifts:", result.staffShifts.reason);
  } else {
    console.log("[seed] Staff:", result.counts.staff);
    console.log("[seed] Shifts:", result.counts.shifts);
    console.log("[seed] Commission slabs:", result.counts.commissionSlabs);
  }

  console.log("[seed] Demo stylist:", result.staffEarnings.config.phone);
  console.log("[seed] Demo bookings:", result.counts.bookings);
  console.log("[seed] Commission entries:", result.counts.commissionEntries);

  console.log("[seed] Note: replace sample pricing after client discovery meeting");
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
