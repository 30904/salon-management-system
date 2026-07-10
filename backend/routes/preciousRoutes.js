import { Router } from "express";
import billingRoutes from "./billingRoutes.js";
import attendanceRoutes from "./attendanceRoutes.js";
import packageRoutes from "./packageRoutes.js";
import whatsappRoutes from "./whatsappRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";

const router = Router();

/**
 * Precious-owned API modules — mount billing, attendance, packages, whatsapp here.
 * Do not register modules in server.js or routes/index.js.
 *
 * Mounted modules:
 *   /invoices & /billing — Billing / POS
 *   /attendance          — Staff attendance punch in/out
 *   /packages            — Package sale & redemption
 *   /whatsapp            — WhatsApp templates & campaigns
 *   /inventory           — Stock management & reports
 */

router.use("/billing", billingRoutes);
router.use("/invoices", billingRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/packages", packageRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/inventory", inventoryRoutes);

export default router;
