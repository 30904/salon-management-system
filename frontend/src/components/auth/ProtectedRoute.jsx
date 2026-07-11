import { Navigate, Outlet, useLocation } from "react-router-dom";
import PageLoader from "../PageLoader.jsx";
import AccessDenied from "./AccessDenied.jsx";
import { usePermission } from "../../hooks/usePermission.js";

/**
 * Guards routes behind authentication and optional RBAC module+action checks.
 * - No token/session → redirect to /login
 * - Missing permission → AccessDenied (authenticated users only)
 */
export default function ProtectedRoute({ module, action = "view", children }) {
  const location = useLocation();
  const { isAuthenticated, permissionsLoaded, hasPermission, navItems } =
    usePermission();

  if (!permissionsLoaded) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (module && !hasPermission(module, action)) {
    const fallbackPath = navItems[0]?.path || "/login";

    if (children) {
      return (
        <AccessDenied
          module={module}
          action={action}
          fallbackPath={fallbackPath}
        />
      );
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return children ?? <Outlet />;
}
