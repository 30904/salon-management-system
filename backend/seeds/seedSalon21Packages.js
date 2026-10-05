/**
 * Seed already-purchased Salon 21 packages from repo-root SALON 21.xlsx.
 *
 * A row with seatings is a prepaid bundle. Credits are the total after "="
 * (or the sum when the sheet only has "8+4"). The package is named from the
 * service column. A row with no seatings is an amount wallet: the invoice
 * uses the discount price, and the spendable balance is the actual price.
 *
 * Each seeded package gets one paid cash invoice dated today, staffed by the
 * owner. Validity is 60 days. Rows with no phone, no service name, or no
 * discount price are left out.
 *
 * Usage:
 *   npm run seed:salon21-packages
 *   SEED_DRY=1 npm run seed:salon21-packages
 */
import dns from "node:dns";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import mongoose from "mongoose";
import XLSX from "xlsx";
import "../models/CommissionSlab.js";
import Branch from "../models/Branch.js";
import Customer from "../models/Customer.js";
import CustomerPackage from "../models/CustomerPackage.js";
import PackageMaster from "../models/PackageMaster.js";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import { PACKAGE_TYPE_AMOUNT_WALLET } from "../constants/packageConstants.js";
import { normalizeImportPhone } from "../services/customerImportService.js";
import { createInvoice } from "../services/billingService.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKBOOK_PATH = path.resolve(__dirname, "../../SALON 21.xlsx");
const VALIDITY_DAYS = 60;
const OWNER_PHONE = process.env.SEED_OWNER_PHONE || "9137045588";
const DRY_RUN = process.env.SEED_DRY === "1";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneFromCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeImportPhone(String(Math.round(value)));
  }
  return normalizeImportPhone(value);
}

function money(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseCredits(seatings) {
  const text = clean(seatings);
  if (!text) return null;

  const equals = text.match(/=\s*(\d+)\b/);
  if (equals) return Number(equals[1]);

  if (text.includes("+")) {
    const parts = [...text.matchAll(/(\d+)/g)].map((match) => Number(match[1]));
    if (parts.length >= 2) return parts[0] + parts[1];
  }

  return null;
}

export function parseSalon21PackageRows(rows) {
  let customerName = "";
  let phone = null;
  const packages = [];
  const skipped = [];

  const skip = (reason, extra = {}) => {
    skipped.push({ reason, customer: customerName, ...extra });
  };

  for (const row of rows) {
    const nameCell = clean(row[0]);
    if (nameCell) {
      customerName = nameCell;
      phone = phoneFromCell(row[1]);
    }

    const serviceName = clean(row[2]);
    const actualPrice = money(row[3]);
    const discountPrice = money(row[4]);
    const seatings = clean(row[5]);

    if (!serviceName && !seatings && actualPrice == null && discountPrice == null) {
      continue;
    }

    if (!customerName) {
      skip("no-customer");
      continue;
    }

    if (!phone?.valid) {
      skip("no-phone", { service: serviceName || seatings });
      continue;
    }

    if (!serviceName) {
      skip("no-service-name", { seatings });
      continue;
    }

    if (discountPrice == null) {
      skip("no-discount-price", { service: serviceName });
      continue;
    }

    const credits = parseCredits(seatings);
    const isPrepaid = Boolean(seatings);

    if (isPrepaid) {
      if (!credits || credits < 1) {
        skip("unreadable-credits", { service: serviceName, seatings });
        continue;
      }
      packages.push({
        customerName,
        phone: phone.digits,
        serviceName,
        type: "prepaid_bundle",
        price: discountPrice,
        walletValue: null,
        creditCount: credits,
        packageName: `50% off (${customerName}) — ${serviceName}`,
      });
      continue;
    }

    if (actualPrice == null || actualPrice <= 0) {
      skip("no-actual-price", { service: serviceName });
      continue;
    }

    packages.push({
      customerName,
      phone: phone.digits,
      serviceName,
      type: PACKAGE_TYPE_AMOUNT_WALLET,
      price: discountPrice,
      walletValue: actualPrice,
      creditCount: 0,
      packageName: `50% off (${customerName}) — ${serviceName}`,
    });
  }

  const seen = new Map();
  for (const pkg of packages) {
    const count = seen.get(pkg.packageName) || 0;
    seen.set(pkg.packageName, count + 1);
    if (count > 0) {
      pkg.packageName = `${pkg.packageName} (${count + 1})`;
    }
  }

  return { packages, skipped };
}

function loadWorkbookRows() {
  const workbook = XLSX.readFile(WORKBOOK_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }).slice(1);
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const label = item[key] || "unknown";
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

async function findCustomer(digits) {
  return Customer.findOne({
    $or: [{ phone: digits }, { phone: `91${digits}` }, { phone: `0${digits}` }],
  });
}

async function main() {
  const { packages, skipped } = parseSalon21PackageRows(loadWorkbookRows());
  const prepaid = packages.filter((pkg) => pkg.type === "prepaid_bundle").length;
  const wallets = packages.length - prepaid;

  console.log(
    `[seed:salon21-packages] ${packages.length} packages to seed (${prepaid} prepaid, ${wallets} wallets). Skipped ${skipped.length}.`
  );
  console.log("[seed:salon21-packages] Skip reasons:", countBy(skipped, "reason"));

  if (DRY_RUN) {
    console.log("[seed:salon21-packages] Dry run — nothing written.");
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const owner = await User.findOne({ phone: OWNER_PHONE, is_active: true });
  if (!owner) {
    throw new Error(`Owner user ${OWNER_PHONE} was not found`);
  }

  const ownerStaff = await StaffProfile.findOne({
    user_id: owner._id,
    is_active: true,
  });
  if (!ownerStaff) {
    throw new Error("Owner staff profile was not found");
  }

  const branch = await Branch.findOne({ is_active: true }).sort({ createdAt: 1 });
  const branchId = branch?._id || null;

  let createdCustomers = 0;
  let createdPackages = 0;
  let createdInvoices = 0;
  let alreadySeeded = 0;

  for (const pkg of packages) {
    let customer = await findCustomer(pkg.phone);
    if (!customer) {
      customer = await Customer.create({
        name: pkg.customerName.slice(0, 120),
        phone: pkg.phone,
        source: "import",
        notes: "Created while seeding SALON 21 package purchases",
      });
      createdCustomers += 1;
    }

    let master = await PackageMaster.findOne({
      name: pkg.packageName,
      branch_id: branchId,
    });

    if (!master) {
      master = await PackageMaster.create({
        name: pkg.packageName,
        type: pkg.type,
        validity_days: VALIDITY_DAYS,
        price: pkg.price,
        wallet_value: pkg.type === PACKAGE_TYPE_AMOUNT_WALLET ? pkg.walletValue : null,
        credit_count: pkg.type === "prepaid_bundle" ? pkg.creditCount : 0,
        included_services: [],
        branch_id: branchId,
        is_active: true,
        discount_logic_json: { source: "salon-21-xlsx" },
      });
      createdPackages += 1;
    }

    const existingPurchase = await CustomerPackage.findOne({
      customer_id: customer._id,
      package_master_id: master._id,
    });
    if (existingPurchase) {
      alreadySeeded += 1;
      continue;
    }

    try {
      await createInvoice(
        {
          customer_id: customer._id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          branch_id: branchId,
          payment_mode: "cash",
          payment_status: "paid",
          notes: "Purchased package seeded from SALON 21.xlsx",
          billing_date: new Date(),
          created_by: owner._id,
          line_items: [
            {
              item_type: "package",
              item_id: master._id,
              item_name: pkg.packageName.slice(0, 200),
              staff_id: ownerStaff._id,
              quantity: 1,
              unit_price: pkg.price,
              discount_amount: 0,
              tax_amount: 0,
              tax_rate: 0,
            },
          ],
        },
        { userId: owner._id }
      );
      createdInvoices += 1;
    } catch (error) {
      console.error(
        `[seed:salon21-packages] Invoice failed for "${pkg.packageName}": ${error.message}`
      );
    }
  }

  console.log("[seed:salon21-packages] Done.", {
    createdCustomers,
    createdPackages,
    createdInvoices,
    alreadySeeded,
  });
}

main()
  .catch((error) => {
    console.error("[seed:salon21-packages] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });
