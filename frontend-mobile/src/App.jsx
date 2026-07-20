import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PermissionProvider } from "./context/PermissionContext.jsx";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Attendance from "./pages/Attendance.jsx";
import Earnings from "./pages/Earnings.jsx";
import Bookings from "./pages/Bookings.jsx";
import Team from "./pages/Team.jsx";
import ReportsLite from "./pages/ReportsLite.jsx";
import Profile from "./pages/Profile.jsx";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <PermissionProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/home" element={<Home />} />
              <Route path="/profile" element={<Profile />} />

              <Route element={<ProtectedRoute module="attendance" />}>
                <Route path="/attendance" element={<Attendance />} />
              </Route>

              <Route element={<ProtectedRoute module="payroll" />}>
                <Route path="/earnings" element={<Earnings />} />
              </Route>

              <Route element={<ProtectedRoute module="bookings" />}>
                <Route path="/bookings" element={<Bookings />} />
              </Route>

              <Route element={<ProtectedRoute module="reports" />}>
                <Route path="/team" element={<Team />} />
                <Route path="/reports" element={<ReportsLite />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </ToastProvider>
      </PermissionProvider>
    </BrowserRouter>
  );
}
