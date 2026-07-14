import { guardedRoute } from "./routeUtils.jsx";

/**
 * Precious-owned routes rendered inside Layout (shell).
 */
export const preciousShellRoutes = (
  <>
    {guardedRoute(
      "/billing",
      () => import("../pages/precious/BillingHome.jsx"),
      { module: "billing" }
    )}

    {guardedRoute(
      "/billing/new",
      () => import("../pages/precious/BillingInvoiceNew.jsx"),
      { module: "billing", action: "create" }
    )}

    {guardedRoute(
      "/invoices",
      () => import("../pages/precious/BillingHome.jsx"),
      { module: "billing" }
    )}

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
      () => import("../pages/settings/whatsapp/TemplateList.jsx"),
      { module: "crm" }
    )}

    {guardedRoute(
      "/whatsapp/templates",
      () => import("../pages/settings/whatsapp/TemplateList.jsx"),
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

    {guardedRoute(
      "/settings/staff",
      () => import("../pages/settings/staff/StaffList.jsx"),
      { module: "settings" }
    )}

    {guardedRoute(
      "/settings/attendance",
      () =>
        import("../pages/settings/attendance/AttendanceMasterHome.jsx"),
      { module: "settings" }
    )}

    {guardedRoute(
      "/settings/packages",
      () => import("../pages/settings/packages/PackageMasterList.jsx"),
      { module: "settings" }
    )}

    {guardedRoute(
      "/settings/whatsapp/templates",
      () => import("../pages/settings/whatsapp/TemplateList.jsx"),
      { module: "settings" }
    )}

    {guardedRoute(
      "/settings/whatsapp",
      () => import("../pages/settings/whatsapp/TemplateList.jsx"),
      { module: "settings" }
    )}
  </>
);