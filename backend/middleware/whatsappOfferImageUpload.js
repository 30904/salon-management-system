import multer from "multer";
import { AppError } from "../utils/AppError.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/**
 * Memory upload for WhatsApp offer images (no S3).
 * Used by POST /api/whatsapp/campaigns/send
 */
export const whatsappOfferImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    const mime = String(file.mimetype || "").toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime)) {
      cb(null, true);
      return;
    }

    cb(new AppError("Offer image must be JPG, PNG, or WebP (max 5MB)", 400));
  },
});

export default whatsappOfferImageUpload;
