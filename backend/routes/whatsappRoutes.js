import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireOwnerOrManager } from "../middleware/requireOwnerOrManager.js";
import { whatsappOfferImageUpload } from "../middleware/whatsappOfferImageUpload.js";
import {
  continueWhatsAppCampaign,
  listWhatsAppCampaigns,
  previewWhatsAppCampaignAudience,
  sendWhatsAppCampaign,
} from "../services/whatsappCampaignService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import whatsappTemplateRoutes from "./whatsappTemplateRoutes.js";

const router = Router();

router.use(authenticate);
router.use("/templates", whatsappTemplateRoutes);

function parseCustomerIds(raw) {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {
      // comma-separated
    }
    return raw.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

router.get(
  "/campaigns/preview",
  requireOwnerOrManager,
  asyncHandler(async (req, res) => {
    const preview = await previewWhatsAppCampaignAudience({
      audience: req.query.audience || "all",
      customer_ids: req.query.customer_ids
        ? String(req.query.customer_ids).split(",").map((id) => id.trim())
        : [],
    });

    return sendSuccess(res, {
      data: preview,
      message: "WhatsApp campaign audience preview ready",
    });
  })
);

router.get(
  "/campaigns",
  requireOwnerOrManager,
  asyncHandler(async (req, res) => {
    const campaigns = await listWhatsAppCampaigns({ limit: req.query.limit });

    return sendSuccess(res, {
      data: campaigns.map((campaign) => ({
        ...campaign.toSafeObject(),
        sent_by_user: campaign.sent_by
          ? {
              id: campaign.sent_by._id,
              name: campaign.sent_by.name,
              phone: campaign.sent_by.phone,
            }
          : null,
      })),
      message: "WhatsApp campaigns retrieved successfully",
    });
  })
);

router.post(
  "/campaigns/send",
  requireOwnerOrManager,
  whatsappOfferImageUpload.single("image"),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const result = await sendWhatsAppCampaign(
      {
        title: body.title,
        campaign_type: body.campaign_type,
        message_body: body.message_body,
        audience: body.audience,
        template_id: body.template_id || undefined,
        customer_ids: parseCustomerIds(body.customer_ids),
        notes: body.notes || "",
      },
      req.user?._id,
      req.file || null
    );

    const willSend = Number(result.will_send_now || 0);
    const queuedTotal = Number(result.queued_count || 0);

    return sendSuccess(res, {
      status: 201,
      data: {
        ...result.campaign.toSafeObject(),
        queued_count: result.queued_count,
        sent_count: result.sent_count,
        failed_count: result.failed_count,
        delivery_mode: result.delivery_mode,
        daily_limit: result.daily_limit,
        sent_today: result.sent_today,
        remaining_today: result.remaining_today,
        will_send_now: result.will_send_now,
        sent_by_user: result.campaign.sent_by
          ? {
              id: result.campaign.sent_by._id,
              name: result.campaign.sent_by.name,
              phone: result.campaign.sent_by.phone,
            }
          : null,
      },
      message:
        willSend > 0
          ? `Offer queued for ${queuedTotal} customer(s). Sending up to ${willSend} now (daily limit ${result.daily_limit}).`
          : `Offer saved for ${queuedTotal} customer(s). Daily limit reached (${result.sent_today}/${result.daily_limit}); continue tomorrow.`,
    });
  })
);

router.post(
  "/campaigns/:id/continue",
  requireOwnerOrManager,
  asyncHandler(async (req, res) => {
    const result = await continueWhatsAppCampaign(req.params.id);

    return sendSuccess(res, {
      data: {
        ...result.campaign.toSafeObject(),
        attempted: result.attempted,
        sent_count: result.sent,
        failed_count: result.failed,
        remaining_queued: result.remaining_queued,
        daily_limit: result.daily_limit,
        sent_today: result.sent_today,
        remaining_today: result.remaining_today,
        will_send_now: result.will_send_now,
        delivery_mode: result.delivery_mode,
      },
      message: `Continuing campaign: up to ${result.will_send_now} message(s) now (${result.remaining_queued} still queued). Refresh in a minute for counts.`,
    });
  })
);

// Legacy single-send stub kept for compatibility
router.post("/send", requireOwnerOrManager, async (req, res) => {
  res.json({
    success: true,
    data: { status: "queued", timestamp: new Date() },
    message: "WhatsApp message queued for delivery",
  });
});

export default router;
