import { Router } from "express";
import {
  createProductHandler,
  deactivateProductHandler,
  getProductHandler,
  listLowStockProductsHandler,
  listProductsHandler,
  updateProductHandler,
} from "../controllers/productMasterController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/low-stock",
  requirePermission("settings", "view"),
  asyncHandler(listLowStockProductsHandler)
);
router.get("/", requirePermission("settings", "view"), asyncHandler(listProductsHandler));
router.get(
  "/:id",
  requirePermission("settings", "view"),
  asyncHandler(getProductHandler)
);
router.post(
  "/",
  requirePermission("settings", "create"),
  asyncHandler(createProductHandler)
);
router.patch(
  "/:id",
  requirePermission("settings", "edit"),
  asyncHandler(updateProductHandler)
);
router.delete(
  "/:id",
  requirePermission("settings", "delete"),
  asyncHandler(deactivateProductHandler)
);

export default router;
