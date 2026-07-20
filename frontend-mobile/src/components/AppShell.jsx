import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";
import MobileHeader from "./MobileHeader.jsx";

export default function AppShell() {
  return (
    <div className="app-shell">
      <MobileHeader />
      <main className="app-shell-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
