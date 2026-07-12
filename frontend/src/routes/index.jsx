import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomeRedirect from "../components/auth/HomeRedirect.jsx";
import { appShellRoute, loginRoute } from "./appShellRoute.jsx";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        {loginRoute}
        {appShellRoute}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
