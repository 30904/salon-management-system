import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import PageLoader from "../components/PageLoader.jsx";

function lazyElement(importFn) {
  const Component = lazy(importFn);
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

const BillingHome = () => import("../pages/precious/BillingHome.jsx");
const AttendanceHome = () => import("../pages/precious/AttendanceHome.jsx");
const PackagesHome = () => import("../pages/precious/PackagesHome.jsx");
const CampaignsHome = () => import("../pages/precious/CampaignsHome.jsx");
const WhatsAppTemplateList = () => import("../pages/settings/whatsapp/TemplateList.jsx");
const InventoryHome = () => import("../pages/precious/InventoryHome.jsx");
const InventoryReports = () => import("../pages/precious/InventoryReports.jsx");

/**
 * Precious-owned routes rendered inside Layout (shell).
 * Lazy-loaded routes for billing, attendance, packages, campaigns, inventory reports.
 */
export const preciousShellRoutes = (
  <>
    <Route path="/billing" element={lazyElement(BillingHome)} />
    <Route path="/invoices" element={lazyElement(BillingHome)} />
    <Route path="/attendance" element={lazyElement(AttendanceHome)} />
    <Route path="/packages" element={lazyElement(PackagesHome)} />
    <Route path="/campaigns" element={lazyElement(WhatsAppTemplateList)} />
    <Route path="/whatsapp" element={lazyElement(WhatsAppTemplateList)} />
    <Route path="/whatsapp/templates" element={lazyElement(WhatsAppTemplateList)} />
    <Route path="/inventory" element={lazyElement(InventoryHome)} />
    <Route path="/inventory/reports" element={lazyElement(InventoryReports)} />
  </>
);
