import { Router } from "express";
import { getDashboardHandler } from "../controllers/dashboardController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/",
  requirePermission("dashboard", "view"),
  asyncHandler(getDashboardHandler)
);

export default router;
