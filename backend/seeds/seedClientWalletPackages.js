/**
 * Seed client amount_wallet PackageMaster tiers (Bronze → Diamond).
 * Idempotent upsert by name (branch_id null).
 *
 * Usage:
 *   npm run seed:client-wallet-packages
 */
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import PackageMaster from "../models/PackageMaster.js";
import {
  CLIENT_WALLET_PACKAGE_TIERS,
  PACKAGE_TYPE_AMOUNT_WALLET,
} from "../constants/packageConstants.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("[seed] Client wallet packages (amount_wallet)\n");

  const results = [];

  for (const tier of CLIENT_WALLET_PACKAGE_TIERS) {
    const doc = await PackageMaster.findOneAndUpdate(
      { name: tier.name, branch_id: null },
      {
        $set: {
          type: PACKAGE_TYPE_AMOUNT_WALLET,
          price: tier.price,
          wallet_value: tier.wallet_value,
          validity_days: tier.validity_days,
          credit_count: 0,
          included_services: [],
          discount_logic_json: {},
          is_active: true,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    results.push({
      name: doc.name,
      price: doc.price,
      wallet_value: doc.wallet_value,
      validity_days: doc.validity_days,
      type: doc.type,
      id: String(doc._id),
    });
  }

  console.log(JSON.stringify({ upserted: results.length, packages: results }, null, 2));

  const count = await PackageMaster.countDocuments({
    type: PACKAGE_TYPE_AMOUNT_WALLET,
    name: { $in: CLIENT_WALLET_PACKAGE_TIERS.map((t) => t.name) },
  });

  if (count !== CLIENT_WALLET_PACKAGE_TIERS.length) {
    throw new Error(
      `Expected ${CLIENT_WALLET_PACKAGE_TIERS.length} wallet masters, found ${count}`
    );
  }

  await mongoose.disconnect();
  console.log("\n[seed] Client wallet packages ready");
}

main().catch(async (err) => {
  console.error("\n[seed] FAILED:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
