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
import { getSessionPermissions } from "../services/permissionService.js";
import { login, me, permissions } from "../controllers/authController.js";

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

  const owner = await User.findOne({ phone: "9999999999" });

  if (!owner) {
    throw new Error("Owner user missing — run npm run seed:dev first");
  }

  const session = await getSessionPermissions(owner._id);

  console.log("[test] Auth permissions API (Sheet 02 row 9)");
  console.log("[test] Permission count:", session.permissions.length);
  console.log("[test] Viewable modules:", session.modules.join(", "));

  const loginReq = {
    body: { phone: "9999999999", password: "Owner@123" },
  };
  const loginRes = mockRes();

  await login(loginReq, loginRes);

  if (!loginRes.body?.success) {
    throw new Error("Login handler failed");
  }

  console.log(
    "[test] POST /auth/login returns permissions:",
    loginRes.body.data.permissions?.length
  );
  console.log(
    "[test] POST /auth/login returns modules:",
    loginRes.body.data.modules?.length
  );

  const authReq = {
    user: owner,
    permissions: session.permissions,
  };
  const meRes = mockRes();
  await me(authReq, meRes);

  console.log(
    "[test] GET /auth/me returns permissions:",
    meRes.body.data.permissions.length
  );

  const permRes = mockRes();
  await permissions(authReq, permRes);

  console.log(
    "[test] GET /auth/permissions returns modules:",
    permRes.body.data.modules.length
  );

  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
