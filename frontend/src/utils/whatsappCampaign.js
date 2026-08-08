import { normalizeWhatsAppPhone } from "./whatsappBooking.js";

/**
 * Prefill WhatsApp offer/sale messages so the owner can tap Send manually
 * (same pattern as booking confirmations and package balance updates).
 */

export function personalizeCampaignMessage(template, customer = {}) {
  const name = customer.name || "Customer";
  const phone = customer.phone || "";
  return String(template || "")
    .replaceAll("{{name}}", name)
    .replaceAll("{{phone}}", phone);
}

export function buildCampaignWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message || "")}`;
}

export function openCampaignWhatsApp({ phone, message } = {}) {
  const url = buildCampaignWhatsAppUrl(phone, message);
  if (!url) {
    window.alert("This customer has no valid phone number for WhatsApp.");
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Resolve the audience list from loaded CRM customers (client-side).
 */
export function resolveCampaignRecipients({
  customers = [],
  audience = "all",
  selectedIds = [],
} = {}) {
  const withPhone = (customers || []).filter((customer) => customer?.phone);
  if (audience === "selected") {
    const idSet = new Set((selectedIds || []).map(String));
    return withPhone.filter((customer) => idSet.has(String(customer.id || customer._id)));
  }
  return withPhone;
}

export function buildRecipientSendList(messageBody, recipients = []) {
  return recipients
    .map((customer) => {
      const phone = customer.phone;
      const message = personalizeCampaignMessage(messageBody, customer);
      const url = buildCampaignWhatsAppUrl(phone, message);
      if (!url) return null;
      return {
        id: String(customer.id || customer._id),
        name: customer.name || "Customer",
        phone,
        message,
        url,
      };
    })
    .filter(Boolean);
}
