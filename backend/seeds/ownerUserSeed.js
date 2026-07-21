import Role, { ROLE_NAMES } from "../models/Role.js";
import User from "../models/User.js";
import StaffProfile from "../models/StaffProfile.js";
import { hashPassword } from "../services/userService.js";
import { seedDefaultBranch } from "./branchSeed.js";

export const DEV_OWNER_ROLE_NAME = ROLE_NAMES.OWNER;

export function getDevOwnerConfig() {
  return {
    roleName: DEV_OWNER_ROLE_NAME,
    name: process.env.SEED_OWNER_NAME || "Salon Owner",
    phone: process.env.SEED_OWNER_PHONE || "9999999999",
    email: process.env.SEED_OWNER_EMAIL || "owner@salon.dev",
    password: process.env.SEED_OWNER_PASSWORD || "Owner@123",
  };
}

/**
 * Ensures the default Owner/CEO dev user exists.
 * Requires branch (row 22) and roles seed (row 23) to have run first.
 */
export async function seedDevOwner(overrides = {}) {
  const config = { ...getDevOwnerConfig(), ...overrides };
  const branch = await seedDefaultBranch();

  const role = await Role.findOne({ name: config.roleName });

  if (!role) {
    throw new Error(
      `${config.roleName} role not found — run npm run seed:roles (or seed:dev) first`
    );
  }

  const password_hash = await hashPassword(config.password);

  const user = await User.findOneAndUpdate(
    { phone: config.phone },
    {
      name: config.name,
      phone: config.phone,
      email: config.email,
      password_hash,
      role_id: role._id,
      branch_id: branch._id,
      is_active: true,
      created_by: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const staffProfile = await StaffProfile.findOneAndUpdate(
    { user_id: user._id },
    {
      user_id: user._id,
      designation: "Salon Director",
      specialization: ["management"],
      base_salary: 0,
      joining_date: new Date(new Date().getFullYear(), 0, 1),
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { branch, role, user, staffProfile, config };
}

export default seedDevOwner;
