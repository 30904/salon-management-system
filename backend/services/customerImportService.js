/**
 * Customer spreadsheet import — parse CSV/XLSX into normalized row objects.
 * Feature 2 tracker: parseCustomerImportFile + importCustomers.
 *
 * Client file mapping (Contacts-24-Aug-02-31.xlsx) is locked in
 * backend/constants/customerImportConstants.js — Full Name→name,
 * Mobile 1–4→phone/notes, Email+Address→notes, SNo→import_row_ref.
 */
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import Customer from "../models/Customer.js";
import CustomerImportBatch from "../models/CustomerImportBatch.js";
import Invoice from "../models/Invoice.js";
import { AppError } from "../utils/AppError.js";
import {
  CLIENT_CONTACTS_IMPORT_FILE,
  CLIENT_CONTACTS_COLUMN_MAP,
} from "../constants/customerImportConstants.js";

/**
 * Case-insensitive header aliases → canonical keys.
 * Supports MD columns and client Contacts-24-Aug-02-31.xlsx headers
 * (see CLIENT_CONTACTS_COLUMN_MAP).
 */
export const CUSTOMER_IMPORT_HEADER_ALIASES = {
  // name
  name: "name",
  "full name": "name",
  customer: "name",
  "customer name": "name",
  // primary phone (generic)
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  "phone number": "phone",
  // client multi-mobile columns
  "mobile 1": "mobile_1",
  mobile1: "mobile_1",
  "mobile 2": "mobile_2",
  mobile2: "mobile_2",
  "mobile 3": "mobile_3",
  mobile3: "mobile_3",
  "mobile 4": "mobile_4",
  mobile4: "mobile_4",
  // optional MD fields
  dob: "dob",
  "date of birth": "dob",
  gender: "gender",
  last_visit_date: "last_visit_date",
  "last visit date": "last_visit_date",
  "last visit": "last_visit_date",
  notes: "notes",
  note: "notes",
  // client extras → notes builder
  email: "email",
  "e-mail": "email",
  address: "address",
  // row ref
  sno: "import_row_ref",
  "s no": "import_row_ref",
  "s.no": "import_row_ref",
  "serial no": "import_row_ref",
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Strip spaces / +91 / dashes → bare 10-digit Indian mobile when possible.
 * @returns {{ digits: string|null, valid: boolean }}
 */
export function normalizeImportPhone(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { digits: null, valid: false };
  }

  let digits = String(raw).replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return { digits: digits || null, valid: false };
  }

  return { digits, valid: true };
}

function cellToString(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseOptionalImportDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const asString = cellToString(value);
  if (!asString) return null;

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseOptionalGender(value) {
  const raw = cellToString(value).toLowerCase();
  if (!raw) return null;
  if (["male", "m", "man"].includes(raw)) return "male";
  if (["female", "f", "woman"].includes(raw)) return "female";
  if (["other", "o"].includes(raw)) return "other";
  if (["prefer_not_to_say", "prefer not to say", "na", "n/a"].includes(raw)) {
    return "prefer_not_to_say";
  }
  return null;
}

/**
 * REQUIRED: unused mobiles + email + address go into notes (never drop extras).
 */
export function buildImportNotes({
  unusedMobiles = [],
  email = "",
  address = "",
  existingNotes = "",
} = {}) {
  const parts = [];
  const alts = unusedMobiles.map((m) => cellToString(m)).filter(Boolean);
  if (alts.length) parts.push(`Alt phones: ${alts.join(", ")}`);
  if (cellToString(email)) parts.push(`Email: ${cellToString(email)}`);
  if (cellToString(address)) parts.push(`Address: ${cellToString(address)}`);
  if (cellToString(existingNotes)) parts.push(cellToString(existingNotes));
  return parts.length ? parts.join(" | ") : null;
}

function mapHeaderRow(headerCells) {
  const columnMap = {}; // canonical → column index
  headerCells.forEach((cell, index) => {
    const alias = CUSTOMER_IMPORT_HEADER_ALIASES[normalizeHeader(cell)];
    if (!alias) return;
    if (columnMap[alias] === undefined) columnMap[alias] = index;
  });
  return columnMap;
}

function pickCell(row, columnMap, key) {
  const index = columnMap[key];
  if (index === undefined) return "";
  return row[index];
}

function normalizeDataRow(row, columnMap, rowNumber) {
  const name = cellToString(pickCell(row, columnMap, "name"));

  const mobileCandidates = [
    pickCell(row, columnMap, "phone"),
    pickCell(row, columnMap, "mobile_1"),
    pickCell(row, columnMap, "mobile_2"),
    pickCell(row, columnMap, "mobile_3"),
    pickCell(row, columnMap, "mobile_4"),
  ]
    .map((v) => cellToString(v))
    .filter(Boolean);

  let phoneDigits = null;
  const unusedMobiles = [];

  for (const candidate of mobileCandidates) {
    const normalized = normalizeImportPhone(candidate);
    if (!phoneDigits && normalized.valid) {
      phoneDigits = normalized.digits;
    } else {
      unusedMobiles.push(candidate);
    }
  }

  // If nothing validated as 10-digit, keep first raw candidate for error reporting
  const rawPhoneFallback = mobileCandidates[0] || null;

  const email = cellToString(pickCell(row, columnMap, "email"));
  const address = cellToString(pickCell(row, columnMap, "address"));
  const existingNotes = cellToString(pickCell(row, columnMap, "notes"));
  const notes = buildImportNotes({
    unusedMobiles,
    email,
    address,
    existingNotes,
  });

  const importRowRef =
    cellToString(pickCell(row, columnMap, "import_row_ref")) || String(rowNumber);

  return {
    row: rowNumber,
    name: name || null,
    phone: phoneDigits,
    phone_raw: phoneDigits ? phoneDigits : rawPhoneFallback,
    dob: parseOptionalImportDate(pickCell(row, columnMap, "dob")),
    gender: parseOptionalGender(pickCell(row, columnMap, "gender")),
    last_visit_date: parseOptionalImportDate(
      pickCell(row, columnMap, "last_visit_date")
    ),
    notes,
    import_row_ref: importRowRef,
  };
}

/**
 * Parse CSV or XLSX buffer into normalized customer import rows.
 * @returns {{ sheet_name: string, rows: Array<object> }}
 */
export function parseCustomerImportFile(buffer, { fileName = "", mimeType = "" } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new AppError("Import file buffer is required", 400);
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new AppError("Unable to parse import file as CSV/XLSX", 400);
  }

  if (!workbook.SheetNames?.length) {
    throw new AppError("Import file has no sheets", 400);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  if (!matrix.length) {
    throw new AppError("Import file is empty", 400);
  }

  const headerRow = matrix[0] || [];
  const columnMap = mapHeaderRow(headerRow);

  if (columnMap.name === undefined) {
    throw new AppError(
      "Import file must include a name column (name / Full Name)",
      400
    );
  }

  const hasPhoneColumn =
    columnMap.phone !== undefined ||
    columnMap.mobile_1 !== undefined ||
    columnMap.mobile_2 !== undefined ||
    columnMap.mobile_3 !== undefined ||
    columnMap.mobile_4 !== undefined;

  if (!hasPhoneColumn) {
    throw new AppError(
      "Import file must include a phone column (phone / Mobile 1–4)",
      400
    );
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] || [];
    const isEmpty = raw.every((cell) => cellToString(cell) === "");
    if (isEmpty) continue;
    rows.push(normalizeDataRow(raw, columnMap, i + 1));
  }

  return {
    file_name: fileName || null,
    mime_type: mimeType || null,
    sheet_name: sheetName,
    rows,
  };
}

async function customerHasPaidVisit(customerId) {
  const invoice = await Invoice.findOne({
    customer_id: customerId,
    payment_status: { $in: ["paid", "partial"] },
  })
    .select("_id")
    .lean();
  return Boolean(invoice);
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

function truncateNotes(notes) {
  if (!notes) return null;
  const text = String(notes);
  if (text.length <= 1000) return text;
  return text.slice(0, 997) + "...";
}

/**
 * Row-by-row import with per-row try/catch (one bad row must not abort the file).
 * Merge on phone: fill empty fields only; never overwrite name/phone.
 */
export async function importCustomers({
  rows,
  uploadedBy,
  fileName = "upload.xlsx",
} = {}) {
  if (!uploadedBy) {
    throw new AppError("uploadedBy is required for customer import", 400);
  }
  if (!Array.isArray(rows)) {
    throw new AppError("rows must be an array", 400);
  }

  const batch = await CustomerImportBatch.create({
    file_name: fileName || "upload.xlsx",
    uploaded_by: uploadedBy,
    total_rows: rows.length,
    created_count: 0,
    merged_count: 0,
    skipped_count: 0,
    error_rows: [],
    status: "processing",
  });

  const batchId = String(batch._id);
  const errorRows = [];

  try {
    for (const row of rows) {
      try {
        const rowNum = row?.row ?? null;
        const name = cellToString(row?.name);
        const phone = row?.phone ? String(row.phone).replace(/\D/g, "") : null;

        if (!name || !phone || phone.length !== 10) {
          errorRows.push({
            row: rowNum,
            reason: !name
              ? "name is required"
              : "phone must be a valid 10-digit number",
          });
          batch.skipped_count += 1;
          continue;
        }

        const existing = await Customer.findOne({ phone });

        if (!existing) {
          await Customer.create({
            name,
            phone,
            dob: row.dob || null,
            gender: row.gender || null,
            notes: truncateNotes(row.notes),
            imported_last_visit_date: row.last_visit_date || null,
            source: "import",
            import_batch_id: batchId,
            import_row_ref: row.import_row_ref
              ? String(row.import_row_ref)
              : rowNum != null
                ? String(rowNum)
                : null,
          });
          batch.created_count += 1;
          continue;
        }

        // Merge: only fill empty fields; never overwrite name/phone
        let changed = false;

        if (isEmptyValue(existing.dob) && row.dob) {
          existing.dob = row.dob;
          changed = true;
        }
        if (isEmptyValue(existing.gender) && row.gender) {
          existing.gender = row.gender;
          changed = true;
        }
        if (isEmptyValue(existing.notes) && row.notes) {
          existing.notes = truncateNotes(row.notes);
          changed = true;
        }

        if (row.last_visit_date && isEmptyValue(existing.imported_last_visit_date)) {
          const hasVisit = await customerHasPaidVisit(existing._id);
          if (!hasVisit) {
            existing.imported_last_visit_date = row.last_visit_date;
            changed = true;
          }
        }

        if (!existing.import_batch_id) {
          existing.import_batch_id = batchId;
          changed = true;
        }
        if (isEmptyValue(existing.import_row_ref) && row.import_row_ref) {
          existing.import_row_ref = String(row.import_row_ref);
          changed = true;
        }

        if (changed) {
          await existing.save();
        }
        batch.merged_count += 1;
      } catch (rowError) {
        errorRows.push({
          row: row?.row ?? null,
          reason: rowError?.message || "Unexpected row error",
        });
        batch.skipped_count += 1;
      }
    }

    batch.error_rows = errorRows;
    batch.status = "completed";
    await batch.save();
  } catch (hardError) {
    batch.error_rows = errorRows;
    batch.status = "failed";
    await batch.save();
    throw hardError;
  }

  return batch;
}

export async function getImportBatchById(batchId) {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new AppError("Invalid import batch id", 400);
  }

  const batch = await CustomerImportBatch.findById(batchId);
  if (!batch) {
    throw new AppError("Import batch not found", 404);
  }
  return batch;
}

export default {
  CUSTOMER_IMPORT_HEADER_ALIASES,
  CLIENT_CONTACTS_IMPORT_FILE,
  CLIENT_CONTACTS_COLUMN_MAP,
  normalizeImportPhone,
  buildImportNotes,
  parseCustomerImportFile,
  importCustomers,
  getImportBatchById,
};
