import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import whatsappTemplateRoutes from "./whatsappTemplateRoutes.js";

const router = Router();

// WhatsApp Messaging & Campaign Templates module
router.use(authenticate);
router.use("/templates", whatsappTemplateRoutes);

router.post("/send", async (req, res) => {
  res.json({
    success: true,
    data: { status: "queued", timestamp: new Date() },
    message: "WhatsApp message queued for delivery",
  });
});

export default router;
