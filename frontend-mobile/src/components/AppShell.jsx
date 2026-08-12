import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";
import MobileHeader from "./MobileHeader.jsx";
import PoweredByFooter from "./PoweredByFooter.jsx";

export default function AppShell() {
  return (
    <div className="app-shell">
      <MobileHeader />
      <main className="app-shell-content">
        <div className="app-shell-body">
          <Outlet />
        </div>
        <PoweredByFooter />
      </main>
      <BottomNav />
    </div>
  );
}
