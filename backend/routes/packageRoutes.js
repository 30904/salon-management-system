import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import CustomerPackage from "../models/CustomerPackage.js";
import PackageMaster from "../models/PackageMaster.js";
import Customer from "../models/Customer.js";
import { getActivePackagesByCustomerId } from "../services/customerService.js";
import {
  checkAndEmitPackageAlerts,
  checkSinglePackageAfterRedeem,
  getAlertHistory,
  clearAlertHistory,
} from "../services/packageAlertService.js";

const router = Router();

// Protect all package routes with JWT authentication
router.use(authenticate);

/**
 * POST /api/customer-packages/sale (or /api/packages/sale)
 * Sell/assign a package to a customer.
 * Automatically calculates expiry_date and credits_remaining from the PackageMaster template.
 */
router.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const { customer_id, package_master_id, invoice_id, purchase_date } = req.body;

    if (!customer_id || !package_master_id) {
      throw new AppError("customer_id and package_master_id are required fields", 400);
    }

    // Verify Customer exists
    const customer = await Customer.findById(customer_id);
    if (!customer) {
      throw new AppError("Specified customer not found", 404);
    }

    // Verify PackageMaster exists and is active
    const pkgMaster = await PackageMaster.findById(package_master_id);
    if (!pkgMaster) {
      throw new AppError("Specified package template not found", 404);
    }
    if (!pkgMaster.is_active) {
      throw new AppError("Specified package template is inactive and cannot be sold", 400);
    }

    // Calculate purchase_date and expiry_date
    const purchaseDt = purchase_date ? new Date(purchase_date) : new Date();
    if (isNaN(purchaseDt.getTime())) {
      throw new AppError("Invalid purchase_date provided", 400);
    }

    const validityDays = Number(pkgMaster.validity_days) || 30;
    const expiryDt = new Date(purchaseDt.getTime() + validityDays * 24 * 60 * 60 * 1000);

    // Initial credits assigned from package template
    const initialCredits = Number(pkgMaster.credit_count) || 0;

    // Create CustomerPackage record
    const customerPackage = await CustomerPackage.create({
      customer_id: customer._id,
      package_master_id: pkgMaster._id,
      purchase_date: purchaseDt,
      expiry_date: expiryDt,
      credits_remaining: initialCredits,
      status: "active",
      invoice_id: invoice_id ? String(invoice_id).trim() : null,
    });

    await customerPackage.populate("customer_id", "name phone email");
    await customerPackage.populate(
      "package_master_id",
      "name type validity_days price included_services credit_count"
    );

    return sendSuccess(res, {
      status: 201,
      data: customerPackage.toSafeObject(),
      message: "Customer package sold and activated successfully",
    });
  })
);

/**
 * GET /api/customer-packages (or /api/packages)
 * List customer packages with optional filters by customer_id, package_master_id, or status
 */
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
      .populate("package_master_id", "name type validity_days price included_services credit_count");

    return sendSuccess(res, {
      data: packages.map((doc) => doc.toSafeObject()),
      message: "Customer packages retrieved successfully",
    });
  })
);

/**
 * POST /api/customer-packages/alerts/trigger
 * Trigger scan for low-credit and expiring-soon packages and emit events for WhatsApp scheduler
 */
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

/**
 * GET /api/customer-packages/alerts/history
 * Get queue history of alerts emitted to the WhatsApp scheduler
 */
router.get(
  "/alerts/history",
  asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      data: getAlertHistory(),
      message: "Retrieved alert queue history for WhatsApp scheduler",
    });
  })
);

/**
 * DELETE /api/customer-packages/alerts/history
 * Clear alert history
 */
router.delete(
  "/alerts/history",
  asyncHandler(async (req, res) => {
    clearAlertHistory();
    return sendSuccess(res, {
      message: "Alert queue history cleared",
    });
  })
);

/**
 * GET /api/customer-packages/customer/:id/active
 * Get active packages for a customer
 */
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

/**
 * GET /api/customer-packages/:id
 * Get details of a single customer package
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await CustomerPackage.findById(req.params.id)
      .populate("customer_id", "name phone email")
      .populate("package_master_id", "name type validity_days price included_services credit_count");

    if (!doc) {
      throw new AppError("Customer package not found", 404);
    }

    return sendSuccess(res, {
      data: doc.toSafeObject(),
      message: "Customer package details retrieved successfully",
    });
  })
);

/**
 * POST /api/customer-packages/:id/redeem
 * Deduct a credit when customer redeems package for a service
 */
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
      .populate("package_master_id", "name type validity_days price included_services credit_count");

    if (!doc) {
      throw new AppError("Customer package not found", 404);
    }

    if (doc.status !== "active") {
      throw new AppError(`Cannot redeem from package with status: ${doc.status}`, 400);
    }

    if (new Date() > doc.expiry_date) {
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
