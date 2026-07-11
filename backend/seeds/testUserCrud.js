import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/Role.js";
import "../models/Branch.js";
import "../models/User.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { signAccessToken } from "../utils/jwt.js";
import {
  activateUserHandler,
  createUserHandler,
  deactivateUserHandler,
  listUsersHandler,
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

  await User.deleteMany({ name: "Test Manager" });

  const req = {
    user: owner,
    permissions: [],
    body: {
      name: "Test Manager",
      phone: `9${Date.now().toString().slice(-9)}`,
      role_id: managerRole._id,
    },
    query: {},
    params: {},
  };

  console.log("[test] User CRUD API (Sheet 02 row 14)");

  const listRes = mockRes();
  await listUsersHandler(req, listRes);
  console.log("[test] GET /users:", listRes.body.data.length, "users");

  const createRes = mockRes();
  await createUserHandler(req, createRes);
  const created = createRes.body.data.user;
  console.log("[test] POST /users created:", created.name, created.phone);
  console.log("[test] Temp password returned:", Boolean(createRes.body.data.tempPassword));

  req.params.id = created.id;
  const deactivateRes = mockRes();
  await deactivateUserHandler(req, deactivateRes);
  console.log("[test] PATCH deactivate is_active:", deactivateRes.body.data.is_active);

  req.params.id = created.id;
  const activateRes = mockRes();
  await activateUserHandler(req, activateRes);
  console.log("[test] PATCH activate is_active:", activateRes.body.data.is_active);

  await User.findByIdAndUpdate(created.id, { is_active: false });
  console.log("[test] Soft-deactivated test user (not hard-deleted)");
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
