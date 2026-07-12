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
    {guardedRoute(
      "/staff/my-calendar",
      () => import("../pages/staff/MyCalendar.jsx"),
      { module: "bookings" }
    )}
    {guardedRoute("/crm", () => import("../pages/crm/CrmHome.jsx"), {
      module: "crm",
    })}
    {guardedRoute("/payroll", () => import("../pages/payroll/PayrollHome.jsx"), {
      module: "payroll",
    })}
    {guardedRoute(
      "/staff/my-earnings",
      () => import("../pages/staff/MyEarnings.jsx"),
      { module: "payroll" }
    )}
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
    {guardedRoute("/users/new", () => import("../pages/users/UserForm.jsx"), {
      module: "users",
      action: "create",
    })}
    {guardedRoute(
      "/users/:id/edit",
      () => import("../pages/users/UserForm.jsx"),
      { module: "users", action: "edit" }
    )}
    {guardedRoute(
      "/users/:id/permissions",
      () => import("../pages/users/UserPermissionOverrides.jsx"),
      { module: "users", action: "edit" }
    )}
    {guardedRoute(
      "/settings",
      () => import("../pages/settings/SettingsHome.jsx"),
      { module: "settings" }
    )}
    {guardedRoute(
      "/settings/services",
      () => import("../pages/settings/services/ServiceList.jsx"),
      { module: "settings" }
    )}
    {guardedRoute(
      "/settings/services/new",
      () => import("../pages/settings/services/ServiceForm.jsx"),
      { module: "settings", action: "create" }
    )}
    {guardedRoute(
      "/settings/services/:id/edit",
      () => import("../pages/settings/services/ServiceForm.jsx"),
      { module: "settings", action: "edit" }
    )}
    {guardedRoute(
      "/settings/products",
      () => import("../pages/settings/products/ProductList.jsx"),
      { module: "settings" }
    )}
    {guardedRoute(
      "/settings/products/new",
      () => import("../pages/settings/products/ProductForm.jsx"),
      { module: "settings", action: "create" }
    )}
    {guardedRoute(
      "/settings/products/:id/edit",
      () => import("../pages/settings/products/ProductForm.jsx"),
      { module: "settings", action: "edit" }
    )}
    {guardedRoute(
      "/settings/tax",
      () => import("../pages/settings/tax/TaxList.jsx"),
      { module: "settings" }
    )}
    {guardedRoute(
      "/settings/tax/new",
      () => import("../pages/settings/tax/TaxForm.jsx"),
      { module: "settings", action: "create" }
    )}
    {guardedRoute(
      "/settings/tax/:id/edit",
      () => import("../pages/settings/tax/TaxForm.jsx"),
      { module: "settings", action: "edit" }
    )}
  </>
);