import { Router } from "express";
import {
  createServiceCategoryHandler,
  createServiceHandler,
  deactivateServiceCategoryHandler,
  deactivateServiceHandler,
  getServiceCategoryHandler,
  getServiceHandler,
  listServiceCategoriesHandler,
  listServicesHandler,
  updateServiceCategoryHandler,
  updateServiceHandler,
} from "../controllers/serviceMasterController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/service-categories",
  requirePermission("settings", "view"),
  asyncHandler(listServiceCategoriesHandler)
);
router.get(
  "/service-categories/:id",
  requirePermission("settings", "view"),
  asyncHandler(getServiceCategoryHandler)
);
router.post(
  "/service-categories",
  requirePermission("settings", "create"),
  asyncHandler(createServiceCategoryHandler)
);
router.patch(
  "/service-categories/:id",
  requirePermission("settings", "edit"),
  asyncHandler(updateServiceCategoryHandler)
);
router.delete(
  "/service-categories/:id",
  requirePermission("settings", "delete"),
  asyncHandler(deactivateServiceCategoryHandler)
);

router.get(
  "/services",
  requirePermission("settings", "view"),
  asyncHandler(listServicesHandler)
);
router.get(
  "/services/:id",
  requirePermission("settings", "view"),
  asyncHandler(getServiceHandler)
);
router.post(
  "/services",
  requirePermission("settings", "create"),
  asyncHandler(createServiceHandler)
);
router.patch(
  "/services/:id",
  requirePermission("settings", "edit"),
  asyncHandler(updateServiceHandler)
);
router.delete(
  "/services/:id",
  requirePermission("settings", "delete"),
  asyncHandler(deactivateServiceHandler)
);

export default router;
