import { Route } from "react-router-dom";
import { guardedRoute, lazyElement } from "./routeUtils.jsx";

const Login = () => import("../pages/auth/Login.jsx");

export const loginRoute = (
  <Route path="/login" element={lazyElement(Login)} />
);

/**
 * Arnav-owned routes rendered inside Layout (shell).
 */
export const arnavShellRoutes = (
  <>
    {guardedRoute("/dashboard", () => import("../pages/dashboard/Dashboard.jsx"), {
      module: "dashboard",
    })}
    {guardedRoute("/bookings", () => import("../pages/bookings/BookingList.jsx"), {
      module: "bookings",
    })}
    {guardedRoute("/crm", () => import("../pages/crm/CrmHome.jsx"), {
      module: "crm",
    })}
    {guardedRoute("/payroll", () => import("../pages/payroll/PayrollHome.jsx"), {
      module: "payroll",
    })}
    {guardedRoute("/reports", () => import("../pages/reports/ReportsHome.jsx"), {
      module: "reports",
    })}
    {guardedRoute(
      "/employees",
      () => import("../pages/employees/EmployeesHome.jsx"),
      { module: "employees" }
    )}
    {guardedRoute("/users", () => import("../pages/users/UserList.jsx"), {
      module: "users",
    })}
    {guardedRoute(
      "/settings",
      () => import("../pages/settings/SettingsHome.jsx"),
      { module: "settings" }
    )}
  </>
);
