import bcrypt from "bcryptjs";
import Role from "../models/Role.js";
import User from "../models/User.js";

const DEV_OWNER = {
  roleName: "Owner/CEO",
  roleDescription: "Full access to every module",
  name: "Salon Owner",
  phone: "9999999999",
  email: "owner@salon.dev",
  password: "Owner@123",
};

export async function seedDevOwner() {
  const role = await Role.findOneAndUpdate(
    { name: DEV_OWNER.roleName },
    { name: DEV_OWNER.roleName, description: DEV_OWNER.roleDescription },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const password_hash = await bcrypt.hash(DEV_OWNER.password, 10);

  const user = await User.findOneAndUpdate(
    { phone: DEV_OWNER.phone },
    {
      name: DEV_OWNER.name,
      phone: DEV_OWNER.phone,
      email: DEV_OWNER.email,
      password_hash,
      role_id: role._id,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { role, user };
}
