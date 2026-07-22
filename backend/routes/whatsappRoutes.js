import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireOwnerOrManager } from "../middleware/requireOwnerOrManager.js";
import {
  listWhatsAppCampaigns,
  previewWhatsAppCampaignAudience,
  sendWhatsAppCampaign,
} from "../services/whatsappCampaignService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import whatsappTemplateRoutes from "./whatsappTemplateRoutes.js";

const router = Router();

router.use(authenticate);
router.use("/templates", whatsappTemplateRoutes);

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
  asyncHandler(async (req, res) => {
    const result = await sendWhatsAppCampaign(req.body || {}, req.user?._id);

    return sendSuccess(res, {
      status: 201,
      data: {
        ...result.campaign.toSafeObject(),
        queued_count: result.queued_count,
        delivery_mode: result.delivery_mode,
        sent_by_user: result.campaign.sent_by
          ? {
              id: result.campaign.sent_by._id,
              name: result.campaign.sent_by.name,
              phone: result.campaign.sent_by.phone,
            }
          : null,
      },
      message: `Offer message queued for ${result.queued_count} customer(s)`,
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
