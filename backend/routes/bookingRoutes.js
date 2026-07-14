import { Router } from "express";
import {
  cancelBookingHandler,
  createBookingHandler,
  getBookingAvailabilityHandler,
  getBookingHandler,
  listBookingsHandler,
  updateBookingHandler,
  updateBookingStatusHandler,
} from "../controllers/bookingController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get(
  "/availability",
  requirePermission("bookings", "view"),
  asyncHandler(getBookingAvailabilityHandler)
);
router.get(
  "/",
  requirePermission("bookings", "view"),
  asyncHandler(listBookingsHandler)
);
router.get(
  "/:id",
  requirePermission("bookings", "view"),
  asyncHandler(getBookingHandler)
);
router.post(
  "/",
  requirePermission("bookings", "create"),
  asyncHandler(createBookingHandler)
);
router.patch(
  "/:id/status",
  requirePermission("bookings", "edit"),
  asyncHandler(updateBookingStatusHandler)
);
router.patch(
  "/:id",
  requirePermission("bookings", "edit"),
  asyncHandler(updateBookingHandler)
);
router.delete(
  "/:id",
  requirePermission("bookings", "delete"),
  asyncHandler(cancelBookingHandler)
);

export default router;
