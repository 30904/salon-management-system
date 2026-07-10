import { Router } from "express";
import authRoutes from "./authRoutes.js";

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

// router.use("/users", userRoutes);
// router.use("/roles", roleRoutes);
// router.use("/services", serviceRoutes);
// router.use("/products", productRoutes);
// router.use("/customers", customerRoutes);
// router.use("/bookings", bookingRoutes);
// router.use("/payroll", payrollRoutes);
// router.use("/reports", reportRoutes);
// router.use("/dashboard", dashboardRoutes);

export default router;
