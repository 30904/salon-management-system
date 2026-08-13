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
  requireAnyPermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/low-stock",
  requireAnyPermission(
    { module: "settings", action: "view" },
    { module: "inventory", action: "view" }
  ),
  asyncHandler(listLowStockProductsHandler)
);
router.get(
  "/",
  requireAnyPermission(
    { module: "settings", action: "view" },
    { module: "inventory", action: "view" }
  ),
  asyncHandler(listProductsHandler)
);
router.get(
  "/:id",
  requireAnyPermission(
    { module: "settings", action: "view" },
    { module: "inventory", action: "view" }
  ),
  asyncHandler(getProductHandler)
);
router.post(
  "/",
  requireAnyPermission(
    { module: "settings", action: "create" },
    { module: "inventory", action: "create" }
  ),
  asyncHandler(createProductHandler)
);
router.patch(
  "/:id",
  requireAnyPermission(
    { module: "settings", action: "edit" },
    { module: "inventory", action: "edit" }
  ),
  asyncHandler(updateProductHandler)
);
router.delete(
  "/:id",
  requireAnyPermission(
    { module: "settings", action: "delete" },
    { module: "inventory", action: "delete" }
  ),
  asyncHandler(deactivateProductHandler)
);

export default router;
