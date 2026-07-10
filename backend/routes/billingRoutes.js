import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Billing & POS routes
router.use(authenticate);

router.get("/", async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: "Billing and Invoices module mounted successfully",
  });
});

router.post("/", async (req, res) => {
  res.status(201).json({
    success: true,
    data: { ...req.body, status: "created", createdAt: new Date() },
    message: "Invoice created successfully",
  });
});

export default router;
