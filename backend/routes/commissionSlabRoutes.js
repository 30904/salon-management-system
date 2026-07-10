import { Router } from "express";
import CommissionSlab from "../models/CommissionSlab.js";
import { authenticate } from "../middleware/authenticate.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// Protect all commission slab endpoints
router.use(authenticate);

/**
 * GET /api/commission-slabs
 * List all commission slabs with optional active status filter
 */
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.is_active !== undefined) {
      filter.is_active = req.query.is_active === "true";
    }

    const slabs = await CommissionSlab.find(filter).sort({ name: 1 });
    return sendSuccess(res, {
      data: slabs.map((slab) => slab.toSafeObject()),
      message: "Commission slabs retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/commission-slabs/:id
 * Retrieve a specific commission slab by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const slab = await CommissionSlab.findById(req.params.id);
    if (!slab) {
      throw new AppError("Commission slab not found", 404);
    }
    return sendSuccess(res, {
      data: slab.toSafeObject(),
      message: "Commission slab retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/commission-slabs
 * Create a new commission slab
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, type, rules_json, is_active } = req.body;

    if (!name || !type) {
      throw new AppError("Name and type are required fields", 400);
    }

    const existing = await CommissionSlab.findOne({ name: name.trim() });
    if (existing) {
      throw new AppError(`Commission slab with name '${name.trim()}' already exists`, 409);
    }

    const slab = await CommissionSlab.create({
      name: name.trim(),
      type,
      rules_json: rules_json || {},
      is_active: is_active !== undefined ? is_active : true,
    });

    return sendSuccess(res, {
      status: 201,
      data: slab.toSafeObject(),
      message: "Commission slab created successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/commission-slabs/:id
 * Update an existing commission slab
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { name, type, rules_json, is_active } = req.body;
    const updatePayload = {};

    if (name !== undefined) updatePayload.name = name.trim();
    if (type !== undefined) updatePayload.type = type;
    if (rules_json !== undefined) updatePayload.rules_json = rules_json;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const slab = await CommissionSlab.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!slab) {
      throw new AppError("Commission slab not found", 404);
    }

    return sendSuccess(res, {
      data: slab.toSafeObject(),
      message: "Commission slab updated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/commission-slabs/:id
 * Soft delete or remove a commission slab
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const slab = await CommissionSlab.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!slab) {
      throw new AppError("Commission slab not found", 404);
    }

    return sendSuccess(res, {
      data: slab.toSafeObject(),
      message: "Commission slab deactivated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
