import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Permission.js";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  seedPermissions,
} from "./permissionSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const result = await seedPermissions();

  console.log("[seed] Permission table ready (Sheet 02 row 4)");
  console.log("[seed] Modules:", PERMISSION_MODULES.length);
  console.log("[seed] Actions:", PERMISSION_ACTIONS.join(", "));
  console.log("[seed] Permission rows:", result.count);
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
