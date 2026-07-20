import { Router } from "express";
import StaffProfile from "../models/StaffProfile.js";
import User from "../models/User.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { loadPermissions, requirePermission } from "../middleware/requirePermission.js";
import { getMyCalendarHandler } from "../controllers/staffCalendarController.js";
import { getMyEarningsHandler } from "../controllers/staffEarningsController.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import {
  getCachedStaffList,
  setCachedStaffList,
} from "../utils/requestCache.js";

const router = Router();

// Protect all staff routes
router.use(authenticate, loadPermissions);

router.get(
  "/me/calendar",
  requirePermission("bookings", "view"),
  asyncHandler(getMyCalendarHandler)
);

router.get(
  "/me/earnings",
  requirePermission("payroll", "view"),
  asyncHandler(getMyEarningsHandler)
);

const USER_POPULATE = {
  path: "user_id",
  select: "name phone email branch_id role_id is_active",
  populate: { path: "branch_id", select: "name code address" },
};

function formatStaffResponse(profile) {
  const userDoc =
    profile.user_id && typeof profile.user_id === "object" && profile.user_id._id
      ? profile.user_id
      : null;

  const shiftDoc =
    profile.shift_id && typeof profile.shift_id === "object" && profile.shift_id._id
      ? profile.shift_id
      : null;

  const slabDoc =
    profile.commission_slab_id &&
    typeof profile.commission_slab_id === "object" &&
    profile.commission_slab_id._id
      ? profile.commission_slab_id
      : null;

  const branchDoc =
    userDoc?.branch_id && typeof userDoc.branch_id === "object" && userDoc.branch_id._id
      ? userDoc.branch_id
      : null;

  return {
    id: profile._id || profile.id,
    user_id: userDoc?._id || profile.user_id,
    designation: profile.designation,
    specialization: profile.specialization || [],
    commission_slab_id: slabDoc?._id || profile.commission_slab_id,
    base_salary: profile.base_salary,
    shift_id: shiftDoc || profile.shift_id,
    joining_date: profile.joining_date,
    is_active: profile.is_active,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    user: userDoc
      ? {
          id: userDoc._id,
          name: userDoc.name,
          phone: userDoc.phone,
          email: userDoc.email,
          branch_id: branchDoc?._id || userDoc.branch_id,
          role_id: userDoc.role_id?._id || userDoc.role_id,
          is_active: userDoc.is_active,
          branch: branchDoc
            ? {
                id: branchDoc._id,
                name: branchDoc.name,
                code: branchDoc.code,
                address: branchDoc.address,
              }
            : null,
        }
      : null,
    shift: shiftDoc
      ? {
          id: shiftDoc._id,
          name: shiftDoc.name,
          start_time: shiftDoc.start_time,
          end_time: shiftDoc.end_time,
          is_active: shiftDoc.is_active,
        }
      : null,
    commission_slab: slabDoc
      ? {
          id: slabDoc._id,
          name: slabDoc.name,
          type: slabDoc.type,
          rules_json: slabDoc.rules_json,
        }
      : null,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const cacheKey = JSON.stringify({
      is_active: req.query.is_active ?? null,
      designation: req.query.designation ?? null,
      specialization: req.query.specialization ?? null,
      branch_id: req.query.branch_id ?? null,
    });
    const cached = getCachedStaffList(cacheKey);

    if (cached) {
      return sendSuccess(res, {
        data: cached,
        message: "Staff profiles retrieved successfully",
      });
    }

    const filter = {};

    // Filter by active status
    if (req.query.is_active !== undefined) {
      filter.is_active = req.query.is_active === "true";
    }

    // Filter by designation
    if (req.query.designation) {
      filter.designation = new RegExp(`^${req.query.designation.trim()}$`, "i");
    }

    // Filter by specialization (e.g., matching stylists who perform a specific service)
    if (req.query.specialization) {
      const specs = req.query.specialization
        .split(",")
        .map((s) => new RegExp(`^${s.trim()}$`, "i"));
      filter.specialization = { $in: specs };
    }

    // Filter by branch_id via the referenced User document
    if (req.query.branch_id) {
      const branchUsers = await User.find({ branch_id: req.query.branch_id }).select("_id");
      const userIds = branchUsers.map((u) => u._id);
      filter.user_id = { $in: userIds };
    }

    const profiles = await StaffProfile.find(filter)
      .populate(USER_POPULATE)
      .populate("commission_slab_id", "name type rules_json")
      .populate("shift_id", "name start_time end_time branch_id is_active")
      .sort({ createdAt: -1 })
      .lean();

    const data = profiles.map((profile) => formatStaffResponse(profile));
    setCachedStaffList(cacheKey, data);

    return sendSuccess(res, {
      data,
      message: "Staff profiles retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/staff/:id
 * Retrieve a specific staff profile by ID (or user_id)
 */
router.get("/:id", async (req, res, next) => {
  try {
    let profile = await StaffProfile.findById(req.params.id)
      .populate(USER_POPULATE)
      .populate("commission_slab_id", "name type rules_json")
      .populate("shift_id", "name start_time end_time branch_id is_active");

    if (!profile) {
      // Check if the parameter passed was actually a user_id
      profile = await StaffProfile.findOne({ user_id: req.params.id })
        .populate(USER_POPULATE)
        .populate("commission_slab_id", "name type rules_json")
        .populate("shift_id", "name start_time end_time branch_id is_active");
    }

    if (!profile) {
      throw new AppError("Staff profile not found", 404);
    }

    return sendSuccess(res, {
      data: formatStaffResponse(profile),
      message: "Staff profile retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/staff
 * Create or assign a staff profile to a user
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      user_id,
      designation,
      specialization = [],
      commission_slab_id = null,
      base_salary = 0,
      shift_id = null,
      joining_date = Date.now(),
      is_active = true,
    } = req.body;

    if (!user_id || !designation) {
      throw new AppError("user_id and designation are required fields", 400);
    }

    // Verify User exists
    const user = await User.findById(user_id);
    if (!user) {
      throw new AppError("Target user not found", 404);
    }

    // Check if staff profile already exists for this user
    const existingProfile = await StaffProfile.findOne({ user_id });
    if (existingProfile) {
      throw new AppError("A staff profile already exists for this user", 409);
    }

    const profile = await StaffProfile.create({
      user_id,
      designation: designation.trim(),
      specialization: Array.isArray(specialization)
        ? specialization.map((s) => s.trim())
        : [specialization.trim()],
      commission_slab_id: commission_slab_id || null,
      base_salary: Number(base_salary) || 0,
      shift_id: shift_id || null,
      joining_date: joining_date ? new Date(joining_date) : new Date(),
      is_active,
    });

    const populated = await StaffProfile.findById(profile._id)
      .populate(USER_POPULATE)
      .populate("commission_slab_id", "name type rules_json")
      .populate("shift_id", "name start_time end_time branch_id is_active");

    return sendSuccess(res, {
      status: 201,
      data: formatStaffResponse(populated),
      message: "Staff profile created successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/staff/:id
 * Update an existing staff profile
 */
router.put("/:id", async (req, res, next) => {
  try {
    const {
      designation,
      specialization,
      commission_slab_id,
      base_salary,
      shift_id,
      joining_date,
      is_active,
    } = req.body;

    const updatePayload = {};
    if (designation !== undefined) updatePayload.designation = designation.trim();
    if (specialization !== undefined) {
      updatePayload.specialization = Array.isArray(specialization)
        ? specialization.map((s) => s.trim())
        : [specialization.trim()];
    }
    if (commission_slab_id !== undefined) updatePayload.commission_slab_id = commission_slab_id || null;
    if (base_salary !== undefined) updatePayload.base_salary = Number(base_salary) || 0;
    if (shift_id !== undefined) updatePayload.shift_id = shift_id || null;
    if (joining_date !== undefined) updatePayload.joining_date = new Date(joining_date);
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const profile = await StaffProfile.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate(USER_POPULATE)
      .populate("commission_slab_id", "name type rules_json")
      .populate("shift_id", "name start_time end_time branch_id is_active");

    if (!profile) {
      throw new AppError("Staff profile not found", 404);
    }

    return sendSuccess(res, {
      data: formatStaffResponse(profile),
      message: "Staff profile updated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/staff/:id
 * Soft delete or deactivate a staff profile
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const profile = await StaffProfile.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    )
      .populate(USER_POPULATE)
      .populate("commission_slab_id", "name type rules_json")
      .populate("shift_id", "name start_time end_time branch_id is_active");

    if (!profile) {
      throw new AppError("Staff profile not found", 404);
    }

    return sendSuccess(res, {
      data: formatStaffResponse(profile),
      message: "Staff profile deactivated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
