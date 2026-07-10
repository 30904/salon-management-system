import { Router } from "express";
import { login, me, refresh } from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);

export default router;
