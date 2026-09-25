/** Repo-root Excel used for client ProductMaster seed. */
export const CLIENT_INVENTORY_FILE = "SALON INVENTORY LIST.xlsx";

/**
 * Parallel name/qty column pairs in Sheet1 (0-based).
 * Headers: Hair retail | Beauty stock | Beauty use | Hair use-stock | Hair stock
 */
export const INVENTORY_SECTIONS = [
  { nameCol: 1, qtyCol: 2, category: "Hair Product", stockType: "Retail", skuPrefix: "HR" },
  { nameCol: 8, qtyCol: 9, category: "Beauty Product", stockType: "Stock", skuPrefix: "BS" },
  { nameCol: 12, qtyCol: 13, category: "Beauty Product", stockType: "Use", skuPrefix: "BU" },
  { nameCol: 19, qtyCol: 20, category: "Hair Product", stockType: "Use Stock", skuPrefix: "HU" },
  { nameCol: 23, qtyCol: 24, category: "Hair Product", stockType: "Stock", skuPrefix: "HS" },
];

/** Section / label rows — never treated as products or brands. */
export const INVENTORY_SKIP_LABELS = new Set(
  [
    "SALON INVENTORY",
    "HAIR PRODUCT",
    "BEAUTY PRODUCT",
    "STOCK",
    "USE",
    "USE STOCK",
    "RETAIL",
    "QUANTITY",
    "OTHER INVENTORY",
    "PRODUCT",
    "RACK PRODUCT",
    "TREATMENTS",
    "SCHWARZKOPF SHAMPOO & MASK",
    "HIGH LIFTING",
    "ZERO AMMONIA",
    "ZERO AMM",
    "ABSULTE",
    "FAISHON LIGHT",
    "COLOUR PLAY",
    "DEVELOPER",
    "NATURIAC",
    "SHAMPOO & CONDITIONER & MASK",
  ].map((s) => s.toUpperCase())
);
