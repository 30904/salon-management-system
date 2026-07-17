import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePermission } from "../hooks/usePermission.js";
import PageLoader from "./PageLoader.jsx";

export default function ProtectedRoute({ module, action = "view" }) {
  const location = useLocation();
  const { isAuthenticated, permissionsLoaded, hasPermission } = usePermission();

  if (!permissionsLoaded) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (module && !hasPermission(module, action)) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
