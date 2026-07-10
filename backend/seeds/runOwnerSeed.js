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
import Role from "../models/Role.js";
import { seedDefaultBranch } from "./branchSeed.js";
import { seedRolesAndPermissions } from "./rolePermissionSeed.js";
import { DEV_OWNER_ROLE_NAME, seedDevOwner } from "./ownerUserSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function ensurePrerequisites() {
  await seedDefaultBranch();

  const ownerRole = await Role.findOne({ name: DEV_OWNER_ROLE_NAME });

  if (!ownerRole) {
    console.log("[seed] Roles missing — running role/permission seed first");
    await seedRolesAndPermissions();
  }
}

async function run() {
  await connectDB();

  console.log("[seed] Ensuring branch + roles (rows 22–23)");
  await ensurePrerequisites();

  console.log("[seed] Creating dev Owner/CEO user (row 24)");
  const { branch, role, user } = await seedDevOwner();

  console.log("[seed] Owner user ready");
  console.log("[seed] Branch:", branch.name, `(${branch.code})`);
  console.log("[seed] Role:", role.name);
  console.log("[seed] User:", user.name, "—", user.phone, user.email);
  console.log("[seed] Dev login credentials — see README.md (not stored in .env)");
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
