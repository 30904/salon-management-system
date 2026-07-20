import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Permission.js";
import "../models/RolePermission.js";
import "../models/Branch.js";
import "../models/User.js";
import "../models/StaffProfile.js";
import { seedDefaultBranch } from "./branchSeed.js";
import { seedRolesAndPermissions } from "./rolePermissionSeed.js";
import { seedDevOwner } from "./ownerUserSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  console.log("[seed] Step 1/3 — default branch");
  const branch = await seedDefaultBranch();

  console.log("[seed] Step 2/3 — roles and permissions");
  const roleSeed = await seedRolesAndPermissions();

  console.log("[seed] Step 3/3 — owner user (depends on branch + roles)");
  const { role, user } = await seedDevOwner();

  console.log("[seed] Done");
  console.log("[seed] Branch:", branch.name, `(${branch.code})`);
  console.log("[seed] Role:", role.name);
  console.log("[seed] Permission rows:", roleSeed.counts.permissions);
  console.log("[seed] Dev owner:", user.phone, user.email);
  console.log("[seed] Dev login credentials — see README.md (not stored in .env)");
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
