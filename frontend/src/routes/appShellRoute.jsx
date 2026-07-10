import Layout from "../components/layout/Layout.jsx";
import { arnavShellRoutes, loginRoute } from "./arnavRoutes.jsx";
import { preciousShellRoutes } from "./preciousRoutes.jsx";

export { loginRoute, arnavShellRoutes };

export const appShellRoute = (
  <Route element={<Layout />}>
    {arnavShellRoutes}
    {preciousShellRoutes}
  </Route>
);
