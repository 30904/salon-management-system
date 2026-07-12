import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/User.js";
import Customer from "../models/Customer.js";
import StaffProfile from "../models/StaffProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[test] Customer model (Sheet 03 row 23)");

  const stylist = await StaffProfile.findOne({ is_active: true });

  const customer = await Customer.findOneAndUpdate(
    { phone: "9001234567" },
    {
      name: "Model Test Customer",
      phone: "9001234567",
      dob: new Date(1992, 4, 15),
      anniversary_date: new Date(2018, 10, 20),
      gender: "female",
      tags: [
        { label: "VIP", type: "manual" },
        { label: "Birthday this week", type: "system" },
      ],
      preferred_stylist_id: stylist?._id || null,
      notes: "Prefers morning appointments.",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const populated = await Customer.populateForList(
    Customer.findById(customer._id)
  );
  const hydrated = await populated;
  const safe = hydrated.toSafeObject();

  console.log("[test] Customer fields:", safe.name, safe.phone, safe.gender);
  console.log("[test] Dates:", Boolean(safe.dob), Boolean(safe.anniversary_date));
  console.log("[test] Tags:", safe.tags.length, safe.tags[0]?.type);
  console.log(
    "[test] Preferred stylist:",
    safe.preferred_stylist?.user?.name || "none"
  );
  console.log("[test] Notes:", safe.notes);
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
