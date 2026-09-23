import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import WhatsAppCampaign, {
  WHATSAPP_AUDIENCE_TYPES,
  WHATSAPP_CAMPAIGN_TYPES,
} from "../models/WhatsAppCampaign.js";
import WhatsAppTemplate from "../models/WhatsAppTemplate.js";
import { AppError } from "../utils/AppError.js";
import { normalizeWhatsAppPhone } from "../utils/whatsappPhone.js";
import {
  buildOfferLine,
  getWhatsAppDailySendLimit,
  sendWhatsAppOfferTemplate,
  uploadWhatsAppMedia,
} from "./whatsappCloudService.js";

const SEND_DELAY_MS = Number(process.env.WHATSAPP_SEND_DELAY_MS) || 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
  const dailyLimit = getWhatsAppDailySendLimit();
  const sentToday = await countSentToday();

  return {
    audience: params.audience || "all",
    recipient_count: customers.length,
    daily_limit: dailyLimit,
    sent_today: sentToday,
    remaining_today: Math.max(0, dailyLimit - sentToday),
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

export async function countSentToday() {
  const since = startOfUtcDay();
  const rows = await WhatsAppCampaign.aggregate([
    { $unwind: "$recipients" },
    {
      $match: {
        "recipients.status": "sent",
        "recipients.sent_at": { $gte: since },
      },
    },
    { $count: "count" },
  ]);
  return Number(rows[0]?.count || 0);
}

function recountCampaign(campaign) {
  const recipients = campaign.recipients || [];
  campaign.sent_count = recipients.filter((r) => r.status === "sent").length;
  campaign.failed_count = recipients.filter((r) => r.status === "failed").length;
  const queued = recipients.filter((r) => r.status === "queued").length;

  if (queued > 0 && campaign.sent_count + campaign.failed_count > 0) {
    campaign.status = "partial";
  } else if (queued > 0) {
    campaign.status = "queued";
  } else if (campaign.failed_count > 0 && campaign.sent_count === 0) {
    campaign.status = "failed";
  } else {
    campaign.status = "sent";
  }
}

/**
 * Process queued recipients up to remaining daily Meta limit.
 */
export async function processCampaignSends(campaignId, { maxToSend = null } = {}) {
  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("WhatsApp campaign not found", 404);
  }

  if (!campaign.meta_media_id) {
    throw new AppError("Campaign has no offer image media id", 400);
  }

  const dailyLimit = getWhatsAppDailySendLimit();
  const sentToday = await countSentToday();
  let remainingToday = Math.max(0, dailyLimit - sentToday);
  if (maxToSend != null) {
    remainingToday = Math.min(remainingToday, Math.max(0, Number(maxToSend) || 0));
  }

  if (remainingToday <= 0) {
    return {
      campaign,
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining_queued: (campaign.recipients || []).filter((r) => r.status === "queued").length,
      daily_limit: dailyLimit,
      sent_today: sentToday,
      remaining_today: 0,
    };
  }

  campaign.status = "sending";
  await campaign.save();

  const offerLine = buildOfferLine(campaign.message_body);
  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < campaign.recipients.length; i += 1) {
    if (attempted >= remainingToday) break;

    const row = campaign.recipients[i];
    if (row.status !== "queued") continue;

    const phone = normalizeWhatsAppPhone(row.phone);
    if (!phone) {
      row.status = "failed";
      row.error = "Invalid phone number";
      failed += 1;
      attempted += 1;
      continue;
    }

    try {
      const result = await sendWhatsAppOfferTemplate({
        toPhone: phone,
        customerName: row.name || "Customer",
        offerLine,
        mediaId: campaign.meta_media_id,
      });
      row.status = "sent";
      row.meta_message_id = result.message_id;
      row.sent_at = new Date();
      row.error = null;
      sent += 1;
    } catch (err) {
      row.status = "failed";
      row.error = String(err.message || "Send failed").slice(0, 500);
      failed += 1;
    }

    attempted += 1;
    campaign.markModified("recipients");
    recountCampaign(campaign);
    await campaign.save();

    if (attempted < remainingToday) {
      await sleep(SEND_DELAY_MS);
    }
  }

  recountCampaign(campaign);
  await campaign.save();

  const freshSentToday = await countSentToday();

  return {
    campaign,
    attempted,
    sent,
    failed,
    remaining_queued: (campaign.recipients || []).filter((r) => r.status === "queued").length,
    daily_limit: dailyLimit,
    sent_today: freshSentToday,
    remaining_today: Math.max(0, dailyLimit - freshSentToday),
  };
}

export async function sendWhatsAppCampaign(payload = {}, actorUserId = null, file = null) {
  const title = String(payload.title || "").trim();
  const messageBody = String(payload.message_body || "").trim();
  const campaignType = String(payload.campaign_type || "offer").trim().toLowerCase();
  const audience = String(payload.audience || "all").trim().toLowerCase();

  if (!title) {
    throw new AppError("Campaign title is required", 400);
  }

  if (!messageBody) {
    throw new AppError("Offer message / details are required", 400);
  }

  if (!file?.buffer?.length) {
    throw new AppError("Offer image is required for WhatsApp Cloud API send", 400);
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

  const recipients = [];
  for (const customer of customers) {
    const phone = normalizeWhatsAppPhone(customer.phone);
    if (!phone) continue;
    recipients.push({
      customer_id: customer._id,
      name: customer.name || "Customer",
      phone: customer.phone,
      status: "queued",
    });
  }

  if (!recipients.length) {
    throw new AppError("No customers with valid WhatsApp phone numbers", 400);
  }

  const mediaId = await uploadWhatsAppMedia(file);
  const templateName = String(
    process.env.WHATSAPP_TEMPLATE_NAME || "_salon_offer_image"
  ).trim();

  const dailyLimit = getWhatsAppDailySendLimit();
  const sentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - sentToday);

  const campaign = await WhatsAppCampaign.create({
    title,
    campaign_type: campaignType,
    message_body: messageBody,
    audience,
    recipient_count: recipients.length,
    sent_count: 0,
    failed_count: 0,
    recipients,
    status: remainingToday > 0 ? "sending" : "queued",
    delivery_mode: "cloud_api",
    meta_media_id: mediaId,
    meta_template_name: templateName,
    template_id: payload.template_id || null,
    sent_by: actorUserId || null,
    notes: String(payload.notes || "").trim(),
  });

  // Background: respect Meta daily limit without blocking the HTTP response
  setImmediate(() => {
    processCampaignSends(campaign._id).catch((err) => {
      console.error("[whatsapp] campaign send failed:", campaign._id, err.message);
    });
  });

  const populated = await WhatsAppCampaign.findById(campaign._id).populate(
    "sent_by",
    "name phone"
  );

  return {
    campaign: populated,
    queued_count: recipients.length,
    sent_count: 0,
    failed_count: 0,
    delivery_mode: "cloud_api",
    daily_limit: dailyLimit,
    sent_today: sentToday,
    remaining_today: remainingToday,
    will_send_now: Math.min(recipients.length, remainingToday),
    meta_media_id: mediaId,
  };
}

export async function continueWhatsAppCampaign(campaignId) {
  if (!mongoose.Types.ObjectId.isValid(String(campaignId))) {
    throw new AppError("Invalid campaign id", 400);
  }

  const existing = await WhatsAppCampaign.findById(campaignId);
  if (!existing) {
    throw new AppError("WhatsApp campaign not found", 404);
  }

  const dailyLimit = getWhatsAppDailySendLimit();
  const sentToday = await countSentToday();
  const remainingToday = Math.max(0, dailyLimit - sentToday);
  const remainingQueued = (existing.recipients || []).filter((r) => r.status === "queued")
    .length;

  if (remainingQueued === 0) {
    throw new AppError("No queued recipients left on this campaign", 400);
  }

  if (remainingToday <= 0) {
    throw new AppError(
      `Daily WhatsApp send limit reached (${sentToday}/${dailyLimit}). Try again tomorrow.`,
      400
    );
  }

  existing.status = "sending";
  await existing.save();

  setImmediate(() => {
    processCampaignSends(campaignId).catch((err) => {
      console.error("[whatsapp] campaign continue failed:", campaignId, err.message);
    });
  });

  const populated = await WhatsAppCampaign.findById(campaignId).populate(
    "sent_by",
    "name phone"
  );

  return {
    campaign: populated,
    attempted: 0,
    sent: 0,
    failed: 0,
    remaining_queued: remainingQueued,
    daily_limit: dailyLimit,
    sent_today: sentToday,
    remaining_today: remainingToday,
    will_send_now: Math.min(remainingQueued, remainingToday),
    delivery_mode: "cloud_api",
  };
}
