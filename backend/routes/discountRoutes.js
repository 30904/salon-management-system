import { Router } from "express";
import {
  createDiscountHandler,
  deactivateDiscountHandler,
  getDiscountHandler,
  listDiscountsHandler,
  updateDiscountHandler,
} from "../controllers/discountMasterController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requireAnyPermission,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/",
  requireAnyPermission(
    { module: "settings", action: "view" },
    { module: "billing", action: "view" }
  ),
  asyncHandler(listDiscountsHandler)
);
router.get(
  "/:id",
  requirePermission("settings", "view"),
  asyncHandler(getDiscountHandler)
);
router.post(
  "/",
  requirePermission("settings", "create"),
  asyncHandler(createDiscountHandler)
);
router.patch(
  "/:id",
  requirePermission("settings", "edit"),
  asyncHandler(updateDiscountHandler)
);
router.delete(
  "/:id",
  requirePermission("settings", "delete"),
  asyncHandler(deactivateDiscountHandler)
);

export default router;
