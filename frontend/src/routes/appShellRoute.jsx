import ProtectedRoute from "../components/auth/ProtectedRoute.jsx";
import Layout from "../components/layout/Layout.jsx";
import { Route } from "react-router-dom";
import { arnavShellRoutes, loginRoute } from "./arnavRoutes.jsx";
import { preciousShellRoutes } from "./preciousRoutes.jsx";

export { loginRoute, arnavShellRoutes };

export const appShellRoute = (
  <Route element={<ProtectedRoute />}>
    <Route element={<Layout />}>
      {arnavShellRoutes}
      {preciousShellRoutes}
    </Route>
  </Route>
);
