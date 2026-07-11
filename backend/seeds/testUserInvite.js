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
import { createUserHandler, resendUserInviteHandler } from "../controllers/userController.js";
import { buildUserInviteMessage, getLoginUrl } from "../services/userInviteService.js";

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
  const stylistRole = await Role.findOne({ name: "Stylist" });

  if (!owner || !stylistRole) {
    throw new Error("Run npm run seed:dev first");
  }

  console.log("[test] User invite stub (Sheet 02 row 16)");
  console.log("[test] Login URL:", getLoginUrl());

  const sampleMessage = buildUserInviteMessage({
    name: "Sample Stylist",
    phone: "9876501234",
    roleName: "Stylist",
    tempPassword: "Temp@Sample123",
    loginUrl: getLoginUrl(),
  });
  console.log("[test] Message preview lines:", sampleMessage.split("\n").length);

  const req = {
    user: owner,
    permissions: [],
    body: {
      name: "Invite Stub Stylist",
      phone: `9${Date.now().toString().slice(-9)}`,
      email: `invite.stub.${Date.now()}@salon.dev`,
      role_id: stylistRole._id,
      send_invite: true,
    },
    params: {},
    query: {},
  };

  const createRes = mockRes();
  await createUserHandler(req, createRes);

  const created = createRes.body.data;
  console.log("[test] Create invite status:", created.invite?.status);
  console.log("[test] Invite channel:", created.invite?.channel);
  console.log("[test] Temp password returned:", Boolean(created.tempPassword));

  req.params.id = created.user.id;
  const resendRes = mockRes();
  await resendUserInviteHandler(req, resendRes);
  console.log("[test] Resend invite status:", resendRes.body.data.invite?.status);

  await User.findByIdAndUpdate(created.user.id, { is_active: false });
  console.log("[test] Done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
