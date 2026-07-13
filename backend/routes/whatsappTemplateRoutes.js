import { Router } from "express";
import WhatsAppTemplate from "../models/WhatsAppTemplate.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireOwnerOrManager } from "../middleware/requireOwnerOrManager.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// Protect all WhatsApp template endpoints: authenticate and restrict to Owner/Manager only
router.use(authenticate);
router.use(requireOwnerOrManager);

/**
 * GET /api/whatsapp-templates
 * List WhatsApp templates with optional filtering by is_active, trigger_type, or search query
 */
router.get("/", async (req, res, next) => {
  try {
    const { is_active, trigger_type, search } = req.query;
    const filter = {};

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }
    if (trigger_type) {
      filter.trigger_type = trigger_type;
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const templates = await WhatsAppTemplate.find(filter).sort({ createdAt: -1 });
    return sendSuccess(res, {
      data: templates.map((t) => t.toSafeObject()),
      message: "WhatsApp templates retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/whatsapp-templates/:id
 * Retrieve a specific WhatsApp template by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const template = await WhatsAppTemplate.findById(req.params.id);
    if (!template) {
      throw new AppError("WhatsApp template not found", 404);
    }
    return sendSuccess(res, {
      data: template.toSafeObject(),
      message: "WhatsApp template retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/whatsapp-templates
 * Create a new WhatsApp template
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, trigger_type, message_body, is_active } = req.body;

    if (!name || !trigger_type || !message_body) {
      throw new AppError("name, trigger_type, and message_body are required fields", 400);
    }

    const template = await WhatsAppTemplate.create({
      name: String(name).trim(),
      trigger_type: String(trigger_type).trim(),
      message_body: String(message_body).trim(),
      is_active: is_active !== undefined ? is_active : true,
    });

    return sendSuccess(res, {
      status: 201,
      data: template.toSafeObject(),
      message: "WhatsApp template created successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/whatsapp-templates/:id
 * Update an existing WhatsApp template
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { name, trigger_type, message_body, is_active } = req.body;
    const template = await WhatsAppTemplate.findById(req.params.id);

    if (!template) {
      throw new AppError("WhatsApp template not found", 404);
    }

    if (name !== undefined) template.name = String(name).trim();
    if (trigger_type !== undefined) template.trigger_type = String(trigger_type).trim();
    if (message_body !== undefined) template.message_body = String(message_body).trim();
    if (is_active !== undefined) template.is_active = is_active;

    await template.save();

    return sendSuccess(res, {
      data: template.toSafeObject(),
      message: "WhatsApp template updated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/whatsapp-templates/:id
 * Delete a WhatsApp template
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const template = await WhatsAppTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      throw new AppError("WhatsApp template not found", 404);
    }

    return sendSuccess(res, {
      message: "WhatsApp template deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
