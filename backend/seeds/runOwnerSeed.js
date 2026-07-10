import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import { seedDevOwner } from "./ownerUserSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();
  const { branch, role, user } = await seedDevOwner();

  console.log("[seed] Branch:", branch.name);
  console.log("[seed] Role:", role.name);
  console.log("[seed] Dev owner user:", user.phone, user.email);
  console.log("[seed] Dev password: Owner@123 (local development only)");
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
