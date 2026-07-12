import { Navigate } from "react-router-dom";
import PageLoader from "../PageLoader.jsx";
import { usePermission } from "../../hooks/usePermission.js";
import { getFirstAllowedPath } from "../../utils/postLoginRedirect.js";

/**
 * Sends authenticated users to their first RBAC-allowed route.
 * Unauthenticated users go to the single shared login URL.
 */
export default function HomeRedirect() {
  const { isAuthenticated, permissionsLoaded, modules, navItems } =
    usePermission();

  if (!permissionsLoaded) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const destination = getFirstAllowedPath(modules, navItems);

  if (!destination) {
    return <Navigate to="/login" replace state={{ noAccess: true }} />;
  }

  return <Navigate to={destination} replace />;
}
