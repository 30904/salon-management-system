import { Router } from "express";
import {
  activateUserHandler,
  createUserHandler,
  deactivateUserHandler,
  getUserHandler,
  getUserPermissionOverridesHandler,
  listUsersHandler,
  updateUserHandler,
  updateUserPermissionOverridesHandler,
} from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get("/", requirePermission("users", "view"), asyncHandler(listUsersHandler));
router.get(
  "/:id/permission-overrides",
  requirePermission("users", "view"),
  asyncHandler(getUserPermissionOverridesHandler)
);
router.put(
  "/:id/permission-overrides",
  requirePermission("users", "edit"),
  asyncHandler(updateUserPermissionOverridesHandler)
);
router.get("/:id", requirePermission("users", "view"), asyncHandler(getUserHandler));
router.post("/", requirePermission("users", "create"), asyncHandler(createUserHandler));
router.patch("/:id", requirePermission("users", "edit"), asyncHandler(updateUserHandler));
router.patch(
  "/:id/deactivate",
  requirePermission("users", "edit"),
  asyncHandler(deactivateUserHandler)
);
router.patch(
  "/:id/activate",
  requirePermission("users", "edit"),
  asyncHandler(activateUserHandler)
);

export default router;
