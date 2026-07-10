import Branch from "../models/Branch.js";

const DEFAULT_BRANCH = {
  name: "Main Salon Branch",
  address: "",
  phone: "",
  is_active: true,
};

/**
 * Ensures the default branch exists (single-branch today).
 * Row 22 seed will call this; exported here for reuse across seeds.
 */
export async function seedDefaultBranch(overrides = {}) {
  const branch = await Branch.findOneAndUpdate(
    { name: DEFAULT_BRANCH.name, is_active: true },
    { ...DEFAULT_BRANCH, ...overrides },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return branch;
}

export default seedDefaultBranch;
