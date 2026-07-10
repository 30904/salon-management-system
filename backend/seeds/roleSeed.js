import Role, { ROLE_NAMES } from "../models/Role.js";

export { ROLE_NAMES };

export const ROLE_SEED_DATA = [
  {
    name: ROLE_NAMES.OWNER,
    description: "Full access to every module including user management",
  },
  {
    name: ROLE_NAMES.MANAGER,
    description:
      "Full operational access — no user management, payroll view only",
  },
  {
    name: ROLE_NAMES.STYLIST,
    description: "Own attendance punch, booking calendar view, and earnings",
  },
  {
    name: ROLE_NAMES.MASSAGE_THERAPIST,
    description:
      "Same access as Stylist — separate role for specialization tracking",
  },
];

/**
 * Seeds the four salon roles (Sheet 02 row 3).
 */
export async function seedRoles() {
  const roles = {};

  for (const roleDef of ROLE_SEED_DATA) {
    roles[roleDef.name] = await Role.findOneAndUpdate(
      { name: roleDef.name },
      { name: roleDef.name, description: roleDef.description },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return {
    roles,
    count: ROLE_SEED_DATA.length,
  };
}

export default seedRoles;
