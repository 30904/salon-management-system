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
const InventoryHome = () => import("../pages/precious/InventoryHome.jsx");

/**
 * Precious-owned routes rendered inside Layout (shell).
 */
export const preciousShellRoutes = (
  <>
    <Route path="/billing" element={lazyElement(BillingHome)} />
    <Route path="/attendance" element={lazyElement(AttendanceHome)} />
    <Route path="/packages" element={lazyElement(PackagesHome)} />
    <Route path="/inventory" element={lazyElement(InventoryHome)} />
  </>
);
