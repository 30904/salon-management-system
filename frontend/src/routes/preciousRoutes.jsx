import { guardedRoute } from "./routeUtils.jsx";

/**
 * Precious-owned routes rendered inside Layout (shell).
 */
export const preciousShellRoutes = (
  <>
    {guardedRoute("/billing", () => import("../pages/precious/BillingHome.jsx"), {
      module: "billing",
    })}
    {guardedRoute("/invoices", () => import("../pages/precious/BillingHome.jsx"), {
      module: "billing",
    })}
    {guardedRoute(
      "/attendance",
      () => import("../pages/precious/AttendanceHome.jsx"),
      { module: "attendance" }
    )}
    {guardedRoute(
      "/packages",
      () => import("../pages/precious/PackagesHome.jsx"),
      { module: "billing" }
    )}
    {guardedRoute(
      "/campaigns",
      () => import("../pages/precious/CampaignsHome.jsx"),
      { module: "crm" }
    )}
    {guardedRoute(
      "/whatsapp",
      () => import("../pages/precious/CampaignsHome.jsx"),
      { module: "crm" }
    )}
    {guardedRoute(
      "/inventory",
      () => import("../pages/precious/InventoryHome.jsx"),
      { module: "inventory" }
    )}
    {guardedRoute(
      "/inventory/reports",
      () => import("../pages/precious/InventoryReports.jsx"),
      { module: "inventory" }
    )}
  </>
);
