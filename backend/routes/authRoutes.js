import { Router } from "express";
import { login, me, refresh } from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.get("/me", authenticate, asyncHandler(me));

export default router;
