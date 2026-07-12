import { Router } from "express";
import { getMyCalendarHandler } from "../controllers/staffCalendarController.js";
import { getMyEarningsHandler } from "../controllers/staffEarningsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/me/calendar",
  requirePermission("bookings", "view"),
  asyncHandler(getMyCalendarHandler)
);

router.get(
  "/me/earnings",
  requirePermission("payroll", "view"),
  asyncHandler(getMyEarningsHandler)
);

export default router;
