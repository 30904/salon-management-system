import multer from "multer";
import { AppError } from "../utils/AppError.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some browsers send this for .csv/.xlsx
]);

const ALLOWED_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

function hasAllowedExtension(originalName = "") {
  const lower = String(originalName).toLowerCase();
  return [...ALLOWED_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

/**
 * Memory upload for CRM customer import (csv/xlsx), 5MB cap.
 * Used by POST /api/customers/import.
 */
export const customerImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
    const extOk = hasAllowedExtension(file.originalname);

    if (mimeOk || extOk) {
      cb(null, true);
      return;
    }

    cb(
      new AppError(
        "Only .csv or .xlsx customer import files are allowed",
        400
      )
    );
  },
});

export default customerImportUpload;
