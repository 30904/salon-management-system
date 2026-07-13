import { Router } from "express";
import authRoutes from "./authRoutes.js";
import auditRoutes from "./auditRoutes.js";
import userRoutes from "./userRoutes.js";
import roleRoutes from "./roleRoutes.js";
import serviceRoutes from "./serviceRoutes.js";
import productRoutes from "./productRoutes.js";
import taxRoutes from "./taxRoutes.js";
import customerRoutes from "./customerRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
const router = Router();

/**
 * Arnav-owned API modules (mount order does not matter).
 * Add new routes here — do not register modules in server.js or routes/index.js.
 *
 * Planned modules:
 *   /users      — User management (Owner/CEO)
 *   /roles      — RBAC roles & permissions
 *   /services   — Service master
 *   /products   — Product master
 *   /customers  — Customer master + CRM
 *   /bookings   — Appointments
 *   /payroll    — Payroll runs
 *   /reports    — Revenue, staff, retention reports
 *   /dashboard  — Owner KPI aggregates
 */

router.use("/auth", authRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use(serviceRoutes);
router.use("/products", productRoutes);
router.use("/taxes", taxRoutes);
router.use("/customers", customerRoutes);
router.use("/dashboard", dashboardRoutes);
// router.use("/bookings", bookingRoutes);
// router.use("/payroll", payrollRoutes);
// router.use("/reports", reportRoutes);
// router.use("/dashboard", dashboardRoutes);
export default router;
