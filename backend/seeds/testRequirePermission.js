import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Permission.js";
import "../models/RolePermission.js";
import "../models/UserMenuOverride.js";
import "../models/User.js";
import User from "../models/User.js";
import { hasPermission, resolveUserPermissions } from "../services/permissionService.js";
import { requirePermission } from "../middleware/requirePermission.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

async function runMiddleware(req, res, middlewares) {
  let index = 0;

  return new Promise((resolve, reject) => {
    const next = (error) => {
      if (error) {
        reject(error);
        return;
      }

      index += 1;

      if (index >= middlewares.length) {
        resolve();
        return;
      }

      middlewares[index](req, res, next);
    };

    middlewares[0](req, res, next);
  });
}

async function run() {
  await connectDB();

  const owner = await User.findOne({ phone: "9999999999" });
  const stylistRoleUser = await User.findOne({ phone: { $ne: "9999999999" } })
    .populate("role_id")
    .limit(1);

  if (!owner) {
    throw new Error("Owner user missing — run npm run seed:dev first");
  }

  const ownerPermissions = await resolveUserPermissions(owner._id);

  console.log("[test] requirePermission middleware (Sheet 02 row 8)");
  console.log(
    "[test] Owner has audit_logs.view:",
    hasPermission(ownerPermissions, "audit_logs", "view")
  );

  const ownerReq = { user: owner, permissions: ownerPermissions };
  const ownerRes = {};

  await runMiddleware(ownerReq, ownerRes, [
    requirePermission("audit_logs", "view"),
  ]);
  console.log("[test] Owner middleware: PASS");

  const fakeStylistPermissions = [{ module: "dashboard", action: "view" }];
  const stylistReq = { user: owner, permissions: fakeStylistPermissions };

  try {
    await runMiddleware(stylistReq, ownerRes, [
      requirePermission("audit_logs", "view"),
    ]);
    console.error("[test] Stylist middleware: FAIL (should have thrown 403)");
    process.exit(1);
  } catch (error) {
    console.log(
      "[test] Stylist middleware blocked:",
      error.status,
      error.message
    );
  }

  if (stylistRoleUser) {
    console.log("[test] Sample non-owner user found:", stylistRoleUser.phone);
  } else {
    console.log("[test] No stylist user seeded yet — simulated denial only");
  }

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
