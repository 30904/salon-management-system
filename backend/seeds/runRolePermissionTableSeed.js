import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Permission.js";
import "../models/RolePermission.js";
import { ROLE_NAMES } from "./roleSeed.js";
import { seedRolePermissions } from "./rolePermissionTableSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const result = await seedRolePermissions();

  console.log("[seed] RolePermission table ready (Sheet 02 row 5)");
  console.log("[seed] Total mappings:", result.counts.total);
  console.log("[seed]", ROLE_NAMES.OWNER + ":", result.counts.owner);
  console.log("[seed]", ROLE_NAMES.MANAGER + ":", result.counts.manager);
  console.log("[seed]", ROLE_NAMES.STYLIST + ":", result.counts.stylist);
  console.log(
    "[seed]",
    ROLE_NAMES.MASSAGE_THERAPIST + ":",
    result.counts.massageTherapist
  );
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
