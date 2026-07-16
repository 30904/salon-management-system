import { Router } from "express";
import { getOwnerReportsHandler } from "../controllers/reportsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/owner",
  requirePermission("reports", "view"),
  asyncHandler(getOwnerReportsHandler)
);

export default router;
