import XLSX from "xlsx";
import {
  INVENTORY_SECTIONS,
  INVENTORY_SKIP_LABELS,
} from "../constants/clientInventoryConstants.js";

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Qty cells are usually numbers; some are notes like "6PACKET 60" or "2BOS 12".
 * Prefer the trailing piece total when present, else the leading count.
 */
export function parseInventoryQty(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const s = String(value).trim();
  if (!s) return null;

  const pack = /(\d+)\s*(PACKET|PACKETS|PACK|BOS|BOX|BOXES)\s*(\d+)/i.exec(s);
  if (pack) return Number(pack[3]);

  const bos = /(\d+)\s*(PACKET|PACKETS|PACK|BOS|BOX|BOXES)\b/i.exec(s);
  if (bos) return Number(bos[1]);

  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(Number(s)));

  const m = /(\d+)/.exec(s);
  return m ? Number(m[1]) : null;
}

function guessUnit(name) {
  const up = name.toUpperCase();
  if (/\bML\b|\bLTR\b|\bL\b/.test(up)) return "bottle";
  if (/\bGR\b|\bG\b/.test(up)) return "pack";
  if (/PACKET|PACK\b/.test(up)) return "pack";
  return "piece";
}

function slugPart(text, max = 36) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "ITEM";
}

function displayName(name, brand) {
  // Color tubes / shade codes are often just "3-0" or "6.15" — keep brand in name.
  if (brand && /^[\d.,\-]+/.test(name) && name.length <= 24) {
    return `${brand} ${name}`.trim();
  }
  return name;
}

/**
 * Parse SALON INVENTORY LIST.xlsx buffer into ProductMaster-ready rows.
 * Same name can appear in Stock vs Use → separate SKUs via stock_type prefix.
 */
export function parseClientInventoryWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    header: 1,
  });

  const products = [];
  const brandHeaders = [];
  const skuCounts = new Map();

  for (const section of INVENTORY_SECTIONS) {
    let brand = "";

    for (let i = 0; i < rows.length; i += 1) {
      const name = cleanCell(rows[i]?.[section.nameCol]);
      if (!name) continue;

      const up = name.toUpperCase();
      if (INVENTORY_SKIP_LABELS.has(up)) continue;

      const qty = parseInventoryQty(rows[i]?.[section.qtyCol]);
      if (qty === null) {
        brand = name;
        brandHeaders.push({
          row: i + 1,
          category: section.category,
          stock_type: section.stockType,
          brand: name,
        });
        continue;
      }

      const finalName = displayName(name, brand);
      const baseSku = `INV-${section.skuPrefix}-${slugPart(finalName)}`;
      const seen = (skuCounts.get(baseSku) || 0) + 1;
      skuCounts.set(baseSku, seen);
      const sku = seen === 1 ? baseSku : `${baseSku}-${seen}`;

      products.push({
        name: finalName,
        brand: brand || undefined,
        category: section.category,
        stock_type: section.stockType,
        sku,
        unit: guessUnit(finalName),
        purchase_price: 0,
        sale_price: 0,
        current_stock: qty,
        reorder_level: 2,
        is_active: true,
        _source_row: i + 1,
      });
    }
  }

  return {
    sheet_name: sheetName,
    products,
    brand_headers: brandHeaders,
  };
}
