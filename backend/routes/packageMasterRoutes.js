import { Router } from "express";
import PackageMaster from "../models/PackageMaster.js";
import { authenticate } from "../middleware/authenticate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// Protect all package master endpoints
router.use(authenticate);

/**
 * GET /api/package-masters
 * List all package definitions with optional filters (type, branch_id, is_active, search)
 */
router.get("/", async (req, res, next) => {
  try {
    const { type, branch_id, is_active, search } = req.query;
    const filter = {};

    if (type) {
      filter.type = type;
    }
    if (branch_id) {
      filter.branch_id = branch_id;
    }
    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const packages = await PackageMaster.find(filter).sort({ name: 1, createdAt: -1 });
    return sendSuccess(res, {
      data: packages.map((pkg) => pkg.toSafeObject()),
      message: "Package definitions retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/package-masters/:id
 * Retrieve a specific package definition by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const pkg = await PackageMaster.findById(req.params.id);
    if (!pkg) {
      throw new AppError("Package definition not found", 404);
    }
    return sendSuccess(res, {
      data: pkg.toSafeObject(),
      message: "Package definition retrieved successfully",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/package-masters
 * Create a new package definition (prepaid_bundle | membership | amount_wallet)
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      name,
      type,
      validity_days,
      price,
      wallet_value,
      included_services,
      credit_count,
      discount_logic_json,
      branch_id,
      is_active,
    } = req.body;

    if (!name || price === undefined || price === null) {
      throw new AppError("Package name and price are required fields", 400);
    }

    if (price < 0) {
      throw new AppError("Price cannot be negative", 400);
    }

    const pkgType = type || "prepaid_bundle";
    const isWallet = pkgType === "amount_wallet";

    let resolvedValidity = 30;
    if (isWallet) {
      resolvedValidity =
        validity_days === null || validity_days === "" || validity_days === undefined
          ? null
          : Number(validity_days);
    } else if (validity_days !== undefined && validity_days !== null && validity_days !== "") {
      resolvedValidity = Number(validity_days);
    }

    const pkg = await PackageMaster.create({
      name: name.trim(),
      type: pkgType,
      validity_days: resolvedValidity,
      price: Number(price),
      wallet_value: isWallet
        ? wallet_value !== undefined && wallet_value !== null && wallet_value !== ""
          ? Number(wallet_value)
          : Number(price)
        : null,
      included_services: isWallet ? [] : included_services || [],
      credit_count: isWallet ? 0 : credit_count !== undefined ? Number(credit_count) : 0,
      discount_logic_json: isWallet ? {} : discount_logic_json || {},
      branch_id: branch_id || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    return sendSuccess(res, {
      status: 201,
      data: pkg.toSafeObject(),
      message: "Package definition created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError("A package definition with this name already exists for the selected branch", 409));
    }
    return next(error);
  }
});

/**
 * PUT /api/package-masters/:id
 * Update an existing package definition
 */
router.put("/:id", async (req, res, next) => {
  try {
    const {
      name,
      type,
      validity_days,
      price,
      wallet_value,
      included_services,
      credit_count,
      discount_logic_json,
      branch_id,
      is_active,
    } = req.body;

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (type !== undefined) updatePayload.type = type;
    if (validity_days !== undefined) {
      updatePayload.validity_days =
        validity_days === null || validity_days === ""
          ? null
          : Number(validity_days);
    }
    if (price !== undefined) {
      if (price < 0) throw new AppError("Price cannot be negative", 400);
      updatePayload.price = Number(price);
    }
    if (wallet_value !== undefined) {
      updatePayload.wallet_value =
        wallet_value === null || wallet_value === ""
          ? null
          : Number(wallet_value);
    }
    if (included_services !== undefined) updatePayload.included_services = included_services;
    if (credit_count !== undefined) updatePayload.credit_count = Number(credit_count);
    if (discount_logic_json !== undefined) updatePayload.discount_logic_json = discount_logic_json;
    if (branch_id !== undefined) updatePayload.branch_id = branch_id || null;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const pkg = await PackageMaster.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!pkg) {
      throw new AppError("Package definition not found", 404);
    }

    return sendSuccess(res, {
      data: pkg.toSafeObject(),
      message: "Package definition updated successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError("A package definition with this name already exists for the selected branch", 409));
    }
    return next(error);
  }
});

/**
 * DELETE /api/package-masters/:id
 * Deactivate or delete a package definition
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const pkg = await PackageMaster.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!pkg) {
      throw new AppError("Package definition not found", 404);
    }

    return sendSuccess(res, {
      data: pkg.toSafeObject(),
      message: "Package definition deactivated successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
