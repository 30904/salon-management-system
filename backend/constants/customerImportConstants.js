/**
 * Feature 2 — client Contacts spreadsheet mapping.
 * Source file (repo root, gitignored PII): Contacts-24-Aug-02-31.xlsx
 * Sheet: contactbackup
 *
 * Client sign-off on headers: docs/Feature-2-CRM-Client-Open-Points.md
 * Parser aliases live in customerImportService.CUSTOMER_IMPORT_HEADER_ALIASES.
 * This file is the locked Ops mapping for Seed 3000 tracker row.
 */
export const CLIENT_CONTACTS_IMPORT_FILE = "Contacts-24-Aug-02-31.xlsx";
export const CLIENT_CONTACTS_SHEET = "contactbackup";

/**
 * Contacts-24-Aug-02-31.xlsx → Customer field mapping.
 * Primary phone = first valid 10-digit among Mobile 1…4 (after +91 normalize).
 * Unused mobiles + Email + Address MUST go into notes (never dropped).
 * SNo → import_row_ref only (not a Customer field).
 * dob / gender / last_visit_date absent → null.
 */
export const CLIENT_CONTACTS_COLUMN_MAP = Object.freeze({
  "SNo": "import_row_ref",
  "Full Name": "name",
  "Email": "notes (Email: …)",
  "Address": "notes (Address: …)",
  "Mobile 1": "phone (primary candidate) or notes Alt phones",
  "Mobile 2": "phone (if earlier empty) or notes Alt phones",
  "Mobile 3": "phone (if earlier empty) or notes Alt phones",
  "Mobile 4": "phone (if earlier empty) or notes Alt phones",
});

export default {
  CLIENT_CONTACTS_IMPORT_FILE,
  CLIENT_CONTACTS_SHEET,
  CLIENT_CONTACTS_COLUMN_MAP,
};
