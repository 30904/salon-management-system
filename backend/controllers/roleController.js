import Role from "../models/Role.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listRolesHandler(_req, res) {
  const roles = await Role.find({}).sort({ name: 1 });

  return sendSuccess(res, {
    data: roles.map((role) => role.toSafeObject()),
    message: "Roles fetched",
  });
}
