import Branch from "../models/Branch.js";

export const DEFAULT_BRANCH_CODE = "MAIN";

function getBranchSeedData(overrides = {}) {
  return {
    code: DEFAULT_BRANCH_CODE,
    name: process.env.SEED_BRANCH_NAME || "Main Salon Branch",
    address: process.env.SEED_BRANCH_ADDRESS || "Salon address — update after client meeting",
    phone: process.env.SEED_BRANCH_PHONE || "",
    is_active: true,
    ...overrides,
  };
}

/**
 * Ensures the default dev/staging branch exists (single-branch today).
 */
export async function seedDefaultBranch(overrides = {}) {
  const payload = getBranchSeedData(overrides);

  const branch = await Branch.findOneAndUpdate(
    { code: DEFAULT_BRANCH_CODE },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return branch;
}

export default seedDefaultBranch;
