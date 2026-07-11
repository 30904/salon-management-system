import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import User from "../models/User.js";
import { seedDevOwner } from "./ownerUserSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();

  const { user, role, branch } = await seedDevOwner();
  const totalUsers = await User.countDocuments();

  console.log("[seed] User table ready (Sheet 02 row 7)");
  console.log("[seed] Bootstrap user:", user.name, user.phone);
  console.log("[seed] Role:", role.name);
  console.log("[seed] Branch:", branch.name, `(${branch.code})`);
  console.log("[seed] Total users:", totalUsers);
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
