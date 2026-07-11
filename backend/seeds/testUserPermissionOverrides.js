import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Permission.js";
import "../models/RolePermission.js";
import "../models/UserMenuOverride.js";
import "../models/Branch.js";
import "../models/User.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import {
  getUserPermissionOverridesHandler,
  updateUserPermissionOverridesHandler,
} from "../controllers/userController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run() {
  await connectDB();

  const owner = await User.findOne({ phone: "9999999999" }).populate(
    "role_id branch_id"
  );
  const managerRole = await Role.findOne({ name: "Manager" });

  if (!owner || !managerRole) {
    throw new Error("Run npm run seed:dev first");
  }

  let target = await User.findOne({ name: "Override Test Manager" });

  if (!target) {
    const { createUser } = await import("../services/userManagementService.js");
    const result = await createUser({
      name: "Override Test Manager",
      phone: `9${Date.now().toString().slice(-9)}`,
      email: `override.test.${Date.now()}@salon.dev`,
      role_id: managerRole._id,
      branch_id: owner.branch_id?._id || owner.branch_id,
      created_by: owner._id,
    });
    target = result.user;
  }

  const req = {
    user: owner,
    permissions: [],
    params: { id: target._id.toString() },
    body: {
      overrides: [
        { module: "audit_logs", action: "view", granted: true },
        { module: "users", action: "view", granted: false },
      ],
    },
    query: {},
  };

  console.log("[test] User permission overrides API (Sheet 02 row 15)");

  const getRes = mockRes();
  await getUserPermissionOverridesHandler(req, getRes);
  console.log("[test] GET overrides:", getRes.body.data.overrides.length);

  const putRes = mockRes();
  await updateUserPermissionOverridesHandler(req, putRes);
  console.log(
    "[test] PUT overrides saved:",
    putRes.body.data.overrides.length
  );
  console.log(
    "[test] Resolved modules include audit_logs:",
    putRes.body.data.modules.includes("audit_logs")
  );

  const getAfterRes = mockRes();
  await getUserPermissionOverridesHandler(req, getAfterRes);
  console.log(
    "[test] GET after PUT overrides:",
    getAfterRes.body.data.overrides.length
  );

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
