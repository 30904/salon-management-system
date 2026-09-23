import { AppError } from "../utils/AppError.js";
import { normalizeWhatsAppPhone } from "../utils/whatsappPhone.js";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

function requireCloudConfig() {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const templateName = String(
    process.env.WHATSAPP_TEMPLATE_NAME || "_salon_offer_image"
  ).trim();
  const templateLanguage = String(
    process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"
  ).trim();

  if (!token || !phoneNumberId) {
    throw new AppError(
      "WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env",
      500
    );
  }

  return { token, phoneNumberId, templateName, templateLanguage };
}

export function getWhatsAppDailySendLimit() {
  const n = Number(process.env.WHATSAPP_DAILY_SEND_LIMIT);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 250;
}

/**
 * Upload image buffer to Meta media API (no long-term S3 storage).
 * @returns {Promise<string>} media id
 */
export async function uploadWhatsAppMedia(file) {
  const { token, phoneNumberId } = requireCloudConfig();

  if (!file?.buffer?.length) {
    throw new AppError("Offer image is required", 400);
  }

  const mime = String(file.mimetype || "image/jpeg");
  const filename = String(file.originalname || "offer.jpg").replace(/[^\w.\-]+/g, "_");

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([file.buffer], { type: mime }), filename);

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.id) {
    const msg =
      json?.error?.message ||
      `WhatsApp media upload failed (HTTP ${res.status})`;
    throw new AppError(msg, 502);
  }

  return String(json.id);
}

/**
 * Offer line for template body variable {{2}}.
 */
export function buildOfferLine(messageBody = "") {
  return String(messageBody || "")
    .replaceAll("{{name}}", "")
    .replaceAll("{{phone}}", "")
    .replace(/^hi\s*,?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/**
 * Send approved marketing template with image header.
 */
export async function sendWhatsAppOfferTemplate({
  toPhone,
  customerName,
  offerLine,
  mediaId,
}) {
  const { token, phoneNumberId, templateName, templateLanguage } =
    requireCloudConfig();

  const to = normalizeWhatsAppPhone(toPhone);
  if (!to) {
    throw new AppError(`Invalid WhatsApp phone: ${toPhone}`, 400);
  }

  if (!mediaId) {
    throw new AppError("WhatsApp media id is required", 400);
  }

  const name = String(customerName || "Customer").trim().slice(0, 60) || "Customer";
  const offer = String(offerLine || "Special offer from S21 Family Salon")
    .trim()
    .slice(0, 600);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: "header",
          parameters: [{ type: "image", image: { id: String(mediaId) } }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: offer },
          ],
        },
      ],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      `WhatsApp send failed (HTTP ${res.status})`;
    const err = new AppError(msg, 502);
    err.meta = json?.error || null;
    throw err;
  }

  return {
    to,
    message_id: json?.messages?.[0]?.id || null,
    message_status: json?.messages?.[0]?.message_status || "accepted",
    raw: json,
  };
}
