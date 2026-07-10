import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Permission.js";
import "../models/RolePermission.js";
import { seedRolesAndPermissions } from "./rolePermissionSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const result = await seedRolesAndPermissions();

  console.log("[seed] Roles and permissions ready");
  console.log("[seed] Permission rows:", result.counts.permissions);
  console.log("[seed] Owner/CEO grants:", result.counts.owner);
  console.log("[seed] Manager grants:", result.counts.manager);
  console.log("[seed] Stylist grants:", result.counts.stylist);
  console.log(
    "[seed] Massage/Spa Therapist grants:",
    result.counts.massageTherapist
  );
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
