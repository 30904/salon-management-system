import bcrypt from "bcryptjs";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { seedDefaultBranch } from "./branchSeed.js";

const DEV_OWNER = {
  roleName: "Owner/CEO",
  roleDescription: "Full access to every module",
  name: "Salon Owner",
  phone: "9999999999",
  email: "owner@salon.dev",
  password: "Owner@123",
};

export async function seedDevOwner() {
  const branch = await seedDefaultBranch();

  const role = await Role.findOne({ name: DEV_OWNER.roleName });

  if (!role) {
    throw new Error(
      `${DEV_OWNER.roleName} role not found — run seed:roles (or seed:dev) first`
    );
  }

  const password_hash = await bcrypt.hash(DEV_OWNER.password, 10);

  const user = await User.findOneAndUpdate(
    { phone: DEV_OWNER.phone },
    {
      name: DEV_OWNER.name,
      phone: DEV_OWNER.phone,
      email: DEV_OWNER.email,
      password_hash,
      role_id: role._id,
      branch_id: branch._id,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { branch, role, user };
}
