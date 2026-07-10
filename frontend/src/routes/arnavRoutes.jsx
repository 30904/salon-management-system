import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import PageLoader from "../components/PageLoader.jsx";

function lazyElement(importFn) {
  const Component = lazy(importFn);
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

const Login = () => import("../pages/auth/Login.jsx");
const Dashboard = () => import("../pages/dashboard/Dashboard.jsx");
const BookingList = () => import("../pages/bookings/BookingList.jsx");
const CrmHome = () => import("../pages/crm/CrmHome.jsx");
const PayrollHome = () => import("../pages/payroll/PayrollHome.jsx");
const ReportsHome = () => import("../pages/reports/ReportsHome.jsx");
const EmployeesHome = () => import("../pages/employees/EmployeesHome.jsx");
const SettingsHome = () => import("../pages/settings/SettingsHome.jsx");
const StaffList = () => import("../pages/settings/staff/StaffList.jsx");
const AttendanceMasterHome = () => import("../pages/settings/attendance/AttendanceMasterHome.jsx");

export const loginRoute = (
  <Route path="/login" element={lazyElement(Login)} />
);

/**
 * Arnav-owned routes rendered inside Layout (shell).
 */
export const arnavShellRoutes = (
  <>
    <Route path="/dashboard" element={lazyElement(Dashboard)} />
    <Route path="/bookings" element={lazyElement(BookingList)} />
    <Route path="/crm" element={lazyElement(CrmHome)} />
    <Route path="/payroll" element={lazyElement(PayrollHome)} />
    <Route path="/reports" element={lazyElement(ReportsHome)} />
    <Route path="/employees" element={lazyElement(EmployeesHome)} />
    <Route path="/settings" element={lazyElement(SettingsHome)} />
    <Route path="/settings/staff" element={lazyElement(StaffList)} />
    <Route path="/settings/attendance" element={lazyElement(AttendanceMasterHome)} />
    <Route path="/staff" element={lazyElement(StaffList)} />
  </>
);
