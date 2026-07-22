import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import WhatsAppCampaign, {
  WHATSAPP_AUDIENCE_TYPES,
  WHATSAPP_CAMPAIGN_TYPES,
} from "../models/WhatsAppCampaign.js";
import WhatsAppTemplate from "../models/WhatsAppTemplate.js";
import { AppError } from "../utils/AppError.js";

function personalizeMessage(template, customer) {
  return String(template || "")
    .replaceAll("{{name}}", customer.name || "Customer")
    .replaceAll("{{phone}}", customer.phone || "");
}

async function resolveRecipients({ audience = "all", customer_ids = [] } = {}) {
  if (!WHATSAPP_AUDIENCE_TYPES.includes(audience)) {
    throw new AppError(`audience must be one of: ${WHATSAPP_AUDIENCE_TYPES.join(", ")}`, 400);
  }

  if (audience === "selected") {
    const ids = (customer_ids || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) {
      throw new AppError("Select at least one customer to send this message", 400);
    }

    const customers = await Customer.find({ _id: { $in: ids } }).sort({ name: 1 });
    return customers;
  }

  return Customer.find({ phone: { $exists: true, $ne: "" } }).sort({ name: 1 });
}

export async function previewWhatsAppCampaignAudience(params = {}) {
  const customers = await resolveRecipients(params);
  return {
    audience: params.audience || "all",
    recipient_count: customers.length,
    sample: customers.slice(0, 5).map((customer) => ({
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
    })),
  };
}

export async function listWhatsAppCampaigns({ limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  return WhatsAppCampaign.find()
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate("sent_by", "name phone");
}

export async function sendWhatsAppCampaign(payload = {}, actorUserId = null) {
  const title = String(payload.title || "").trim();
  const messageBody = String(payload.message_body || "").trim();
  const campaignType = String(payload.campaign_type || "offer").trim().toLowerCase();
  const audience = String(payload.audience || "all").trim().toLowerCase();

  if (!title) {
    throw new AppError("Campaign title is required", 400);
  }

  if (!messageBody) {
    throw new AppError("Message body is required", 400);
  }

  if (!WHATSAPP_CAMPAIGN_TYPES.includes(campaignType)) {
    throw new AppError(`campaign_type must be one of: ${WHATSAPP_CAMPAIGN_TYPES.join(", ")}`, 400);
  }

  if (payload.template_id) {
    if (!mongoose.Types.ObjectId.isValid(payload.template_id)) {
      throw new AppError("Invalid template_id", 400);
    }
    const template = await WhatsAppTemplate.findById(payload.template_id);
    if (!template) {
      throw new AppError("WhatsApp template not found", 404);
    }
  }

  const customers = await resolveRecipients({
    audience,
    customer_ids: payload.customer_ids,
  });

  if (!customers.length) {
    throw new AppError("No customers found for this audience", 400);
  }

  const recipients = customers.map((customer) => ({
    customer_id: customer._id,
    name: customer.name,
    phone: customer.phone,
    status: "queued",
    personalized_message: personalizeMessage(messageBody, customer),
  }));

  // Provisioning layer: queue in DB now. Real Meta WhatsApp delivery can plug in later.
  const campaign = await WhatsAppCampaign.create({
    title,
    campaign_type: campaignType,
    message_body: messageBody,
    audience,
    recipient_count: recipients.length,
    recipients: recipients.map(({ customer_id, name, phone, status }) => ({
      customer_id,
      name,
      phone,
      status,
    })),
    status: "queued",
    template_id: payload.template_id || null,
    sent_by: actorUserId || null,
    notes: String(payload.notes || "").trim(),
  });

  const populated = await WhatsAppCampaign.findById(campaign._id).populate(
    "sent_by",
    "name phone"
  );

  return {
    campaign: populated,
    queued_count: recipients.length,
    delivery_mode: "queued_stub",
  };
}
