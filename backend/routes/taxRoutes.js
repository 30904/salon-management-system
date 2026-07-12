import { Router } from "express";
import {
  createTaxHandler,
  deactivateTaxHandler,
  getTaxHandler,
  listTaxesHandler,
  updateTaxHandler,
} from "../controllers/taxMasterController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get("/", requirePermission("settings", "view"), asyncHandler(listTaxesHandler));
router.get(
  "/:id",
  requirePermission("settings", "view"),
  asyncHandler(getTaxHandler)
);
router.post(
  "/",
  requirePermission("settings", "create"),
  asyncHandler(createTaxHandler)
);
router.patch(
  "/:id",
  requirePermission("settings", "edit"),
  asyncHandler(updateTaxHandler)
);
router.delete(
  "/:id",
  requirePermission("settings", "delete"),
  asyncHandler(deactivateTaxHandler)
);

export default router;
