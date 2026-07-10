import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Branch.js";
import { seedDefaultBranch } from "./branchSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function run() {
  await connectDB();
  const branch = await seedDefaultBranch();

  console.log("[seed] Default branch ready");
  console.log("[seed] code:", branch.code);
  console.log("[seed] name:", branch.name);
  console.log("[seed] address:", branch.address);
  console.log("[seed] phone:", branch.phone || "(not set)");
  console.log("[seed] id:", branch._id.toString());
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
