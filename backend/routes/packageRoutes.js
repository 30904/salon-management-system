import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Salon Packages & Redemptions module
router.use(authenticate);

router.get("/", async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: "Packages module mounted successfully",
  });
});

router.post("/", async (req, res) => {
  res.status(201).json({
    success: true,
    data: { ...req.body, createdAt: new Date() },
    message: "Package created successfully",
  });
});

export default router;
