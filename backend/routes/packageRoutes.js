import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import CustomerPackage from "../models/CustomerPackage.js";
import PackageMaster from "../models/PackageMaster.js";
import Customer from "../models/Customer.js";
import { getActivePackagesByCustomerId } from "../services/customerService.js";
import {
  addFamilyMember,
  removeFamilyMember,
} from "../services/packageFamilyService.js";
import { PACKAGE_TYPE_AMOUNT_WALLET } from "../constants/packageConstants.js";
import {
  checkAndEmitPackageAlerts,
  checkSinglePackageAfterRedeem,
  getAlertHistory,
  clearAlertHistory,
} from "../services/packageAlertService.js";

const router = Router();

const PACKAGE_MASTER_POPULATE =
  "name type validity_days price wallet_value included_services credit_count";

router.use(authenticate);

/**
 * POST /api/customer-packages/sale
 * amount_wallet: wallet_balance from wallet_value; expiry_date null when no validity.
 */
router.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const { customer_id, package_master_id, invoice_id, purchase_date } = req.body;

    if (!customer_id || !package_master_id) {
      throw new AppError("customer_id and package_master_id are required fields", 400);
    }

    const customer = await Customer.findById(customer_id);
    if (!customer) {
      throw new AppError("Specified customer not found", 404);
    }

    const pkgMaster = await PackageMaster.findById(package_master_id);
    if (!pkgMaster) {
      throw new AppError("Specified package template not found", 404);
    }
    if (!pkgMaster.is_active) {
      throw new AppError("Specified package template is inactive and cannot be sold", 400);
    }

    const purchaseDt = purchase_date ? new Date(purchase_date) : new Date();
    if (isNaN(purchaseDt.getTime())) {
      throw new AppError("Invalid purchase_date provided", 400);
    }

    const isWallet = pkgMaster.type === PACKAGE_TYPE_AMOUNT_WALLET;
    let expiryDt = null;
    if (!isWallet || (pkgMaster.validity_days != null && Number(pkgMaster.validity_days) >= 1)) {
      const validityDays = Number(pkgMaster.validity_days) || 30;
      expiryDt = new Date(purchaseDt.getTime() + validityDays * 24 * 60 * 60 * 1000);
    }

    const customerPackage = await CustomerPackage.create({
      customer_id: customer._id,
      package_master_id: pkgMaster._id,
      purchase_date: purchaseDt,
      expiry_date: expiryDt,
      credits_remaining: isWallet ? 0 : Number(pkgMaster.credit_count) || 0,
      wallet_balance: isWallet
        ? Number(pkgMaster.wallet_value ?? pkgMaster.price) || 0
        : null,
      linked_family_customer_ids: [],
      status: "active",
      invoice_id: invoice_id ? String(invoice_id).trim() : null,
    });

    await customerPackage.populate("customer_id", "name phone email");
    await customerPackage.populate("package_master_id", PACKAGE_MASTER_POPULATE);

    return sendSuccess(res, {
      status: 201,
      data: customerPackage.toSafeObject(),
      message: "Customer package sold and activated successfully",
    });
  })
);

/**
 * POST /api/customer-packages/:customerPackageId/family-members
 * Live RBAC: billing.edit (no separate packages module).
 */
router.post(
  "/:customerPackageId/family-members",
  requirePermission("billing", "edit"),
  asyncHandler(async (req, res) => {
    const customerId = req.body?.customer_id;
    if (!customerId) {
      throw new AppError("customer_id is required", 400);
    }

    const customerPackage = await addFamilyMember(
      req.params.customerPackageId,
      customerId
    );

    return sendSuccess(res, {
      status: 201,
      data: customerPackage.toSafeObject(),
      message: "Family member added to wallet package",
    });
  })
);

/**
 * DELETE /api/customer-packages/:customerPackageId/family-members/:customerId
 */
router.delete(
  "/:customerPackageId/family-members/:customerId",
  requirePermission("billing", "edit"),
  asyncHandler(async (req, res) => {
    const customerPackage = await removeFamilyMember(
      req.params.customerPackageId,
      req.params.customerId
    );

    return sendSuccess(res, {
      data: customerPackage.toSafeObject(),
      message: "Family member removed from wallet package",
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { customer_id, package_master_id, status } = req.query;
    const filter = {};

    if (customer_id) filter.customer_id = customer_id;
    if (package_master_id) filter.package_master_id = package_master_id;
    if (status) filter.status = status;

    const packages = await CustomerPackage.find(filter)
      .sort({ purchase_date: -1 })
      .populate("customer_id", "name phone email")
      .populate("package_master_id", PACKAGE_MASTER_POPULATE)
      .populate("linked_family_customer_ids", "name phone email");

    return sendSuccess(res, {
      data: packages.map((doc) => doc.toSafeObject()),
      message: "Customer packages retrieved successfully",
    });
  })
);

router.post(
  "/alerts/trigger",
  asyncHandler(async (req, res) => {
    const { expiry_days_threshold = 7, low_credit_threshold = 2 } = req.body;
    const result = await checkAndEmitPackageAlerts({
      expiryDaysThreshold: Number(expiry_days_threshold),
      lowCreditThreshold: Number(low_credit_threshold),
    });

    return sendSuccess(res, {
      data: result,
      message: `Triggered alerts: ${result.expiringSoonAlerts.length} expiry alert(s) and ${result.lowCreditAlerts.length} low-credit alert(s) emitted to WhatsApp scheduler`,
    });
  })
);

router.get(
  "/alerts/history",
  asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      data: getAlertHistory(),
      message: "Retrieved alert queue history for WhatsApp scheduler",
    });
  })
);

router.delete(
  "/alerts/history",
  asyncHandler(async (req, res) => {
    clearAlertHistory();
    return sendSuccess(res, {
      message: "Alert queue history cleared",
    });
  })
);

router.get(
  "/customer/:id/active",
  asyncHandler(async (req, res) => {
    const packages = await getActivePackagesByCustomerId(req.params.id);
    return sendSuccess(res, {
      data: packages.map((doc) => doc.toSafeObject()),
      message: "Active customer packages fetched successfully for billing redemption UI",
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await CustomerPackage.findById(req.params.id)
      .populate("customer_id", "name phone email")
      .populate("package_master_id", PACKAGE_MASTER_POPULATE)
      .populate("linked_family_customer_ids", "name phone email");

    if (!doc) {
      throw new AppError("Customer package not found", 404);
    }

    return sendSuccess(res, {
      data: doc.toSafeObject(),
      message: "Customer package details retrieved successfully",
    });
  })
);

router.post(
  "/:id/redeem",
  asyncHandler(async (req, res) => {
    const { credits_used = 1 } = req.body;
    const creditsToDeduct = Number(credits_used);

    if (isNaN(creditsToDeduct) || creditsToDeduct <= 0) {
      throw new AppError("credits_used must be a positive number", 400);
    }

    const doc = await CustomerPackage.findById(req.params.id)
      .populate("customer_id", "name phone email")
      .populate("package_master_id", PACKAGE_MASTER_POPULATE);

    if (!doc) {
      throw new AppError("Customer package not found", 404);
    }

    if (doc.status !== "active") {
      throw new AppError(`Cannot redeem from package with status: ${doc.status}`, 400);
    }

    if (doc.expiry_date && new Date() > new Date(doc.expiry_date)) {
      doc.status = "expired";
      await doc.save();
      throw new AppError("This package has expired", 400);
    }

    if (doc.credits_remaining < creditsToDeduct) {
      throw new AppError(
        `Insufficient credits. Package only has ${doc.credits_remaining} credits remaining.`,
        400
      );
    }

    doc.credits_remaining -= creditsToDeduct;
    if (doc.credits_remaining === 0) {
      doc.status = "exhausted";
    }

    await doc.save();
    await checkSinglePackageAfterRedeem(doc);

    return sendSuccess(res, {
      data: doc.toSafeObject(),
      message: `Successfully redeemed ${creditsToDeduct} credit(s)`,
    });
  })
);

export default router;
