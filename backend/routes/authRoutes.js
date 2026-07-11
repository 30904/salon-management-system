import { Router } from "express";
import { login, me, permissions, refresh } from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { loadPermissions } from "../middleware/requirePermission.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.get("/me", authenticate, loadPermissions, asyncHandler(me));
router.get("/permissions", authenticate, loadPermissions, asyncHandler(permissions));

export default router;
