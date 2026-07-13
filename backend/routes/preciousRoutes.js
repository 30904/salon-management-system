import { Router } from "express";
import billingRoutes from "./billingRoutes.js";
import attendanceRoutes from "./attendanceRoutes.js";
import packageRoutes from "./packageRoutes.js";
import packageMasterRoutes from "./packageMasterRoutes.js";
import whatsappRoutes from "./whatsappRoutes.js";
import whatsappTemplateRoutes from "./whatsappTemplateRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import staffRoutes from "./staffRoutes.js";
import commissionSlabRoutes from "./commissionSlabRoutes.js";
import shiftRoutes from "./shiftRoutes.js";
import attendanceRuleRoutes from "./attendanceRuleRoutes.js";

const router = Router();

/**
 * Precious-owned API modules — mount billing, attendance, packages, whatsapp, staff, commission slabs here.
 * Do not register modules in server.js or routes/index.js.
 *
 * Mounted modules:
 *   /invoices & /billing — Billing / POS
 *   /attendance          — Staff attendance punch in/out
 *   /packages            — Package sale & redemption
 *   /package-masters     — Package Master definitions (prepaid bundles & memberships)
 *   /whatsapp            — WhatsApp campaigns & messaging
 *   /whatsapp-templates  — WhatsApp Template CRUD (Owner/Manager only)
 *   /inventory           — Stock management & reports
 *   /staff               — Staff profiles & specialization filter (for bookings API)
 *   /commission-slabs    — Commission slab rules & management
 *   /shifts              — Shift schedules (start/end times)
 *   /attendance-rules    — Late marks & leave type rules (feeds attendance + payroll deduction logic)
 */

router.use("/billing", billingRoutes);
router.use("/invoices", billingRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/packages", packageRoutes);
router.use("/package-masters", packageMasterRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/whatsapp-templates", whatsappTemplateRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/staff", staffRoutes);
router.use("/commission-slabs", commissionSlabRoutes);
router.use("/shifts", shiftRoutes);
router.use("/attendance-rules", attendanceRuleRoutes);

export default router;
