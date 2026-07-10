import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import { ROLE_SEED_DATA, seedRoles } from "./roleSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const result = await seedRoles();

  console.log("[seed] Role table ready (Sheet 02 row 3)");
  console.log("[seed] Roles seeded:", result.count);
  for (const roleDef of ROLE_SEED_DATA) {
    const role = result.roles[roleDef.name];
    console.log(`[seed]  - ${role.name}: ${role.description}`);
  }
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
