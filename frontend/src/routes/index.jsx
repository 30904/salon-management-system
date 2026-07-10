import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { appShellRoute, loginRoute } from "./appShellRoute.jsx";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {loginRoute}
        {appShellRoute}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
