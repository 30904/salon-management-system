import { Router } from "express";

const router = Router();

/**
 * Precious-owned API modules — mount billing, attendance, packages, whatsapp here.
 * Do not register modules in server.js or routes/index.js.
 *
 * Planned modules:
 *   /invoices    — Billing / POS
 *   /attendance  — Punch in/out
 *   /packages    — Package sale & redemption
 *   /whatsapp    — Templates & campaigns
 *   /inventory   — Stock reports
 */

// router.use("/invoices", invoiceRoutes);
// router.use("/attendance", attendanceRoutes);
// router.use("/packages", packageRoutes);
// router.use("/whatsapp", whatsappRoutes);
// router.use("/inventory", inventoryRoutes);

export default router;
