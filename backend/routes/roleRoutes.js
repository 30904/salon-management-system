import { Router } from "express";
import { listRolesHandler } from "../controllers/roleController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loadPermissions,
  requirePermission,
} from "../middleware/requirePermission.js";

const router = Router();

router.use(authenticate, loadPermissions);

router.get("/", requirePermission("users", "view"), asyncHandler(listRolesHandler));

export default router;
