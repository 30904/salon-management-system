import { Router } from "express";
import {
  createCustomerHandler,
  findOrCreateCustomerHandler,
  getCustomerHandler,
  listCustomersHandler,
  searchCustomersHandler,
  updateCustomerHandler,
} from "../controllers/customerController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/search",
  requirePermission("crm", "view"),
  asyncHandler(searchCustomersHandler)
);
router.post(
  "/find-or-create",
  requirePermission("crm", "create"),
  asyncHandler(findOrCreateCustomerHandler)
);
router.get("/", requirePermission("crm", "view"), asyncHandler(listCustomersHandler));
router.get(
  "/:id",
  requirePermission("crm", "view"),
  asyncHandler(getCustomerHandler)
);
router.post(
  "/",
  requirePermission("crm", "create"),
  asyncHandler(createCustomerHandler)
);
router.patch(
  "/:id",
  requirePermission("crm", "edit"),
  asyncHandler(updateCustomerHandler)
);

export default router;
