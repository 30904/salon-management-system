import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/User.js";
import "../models/Permission.js";
import "../models/UserMenuOverride.js";
import UserMenuOverride from "../models/UserMenuOverride.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const count = await UserMenuOverride.countDocuments();

  console.log("[seed] UserMenuOverride table ready (Sheet 02 row 6)");
  console.log("[seed] Overrides are created at runtime by Owner/CEO — not seeded");
  console.log("[seed] Current override rows:", count);
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
