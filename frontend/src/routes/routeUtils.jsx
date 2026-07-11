import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import PageLoader from "../components/PageLoader.jsx";
import ProtectedRoute from "../components/auth/ProtectedRoute.jsx";

export function lazyElement(importFn) {
  const Component = lazy(importFn);

  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

/**
 * Route with auth + optional module/action RBAC gate.
 */
export function guardedRoute(path, importFn, { module, action = "view" } = {}) {
  const element = (
    <ProtectedRoute module={module} action={action}>
      {lazyElement(importFn)}
    </ProtectedRoute>
  );

  return <Route key={path} path={path} element={element} />;
}
