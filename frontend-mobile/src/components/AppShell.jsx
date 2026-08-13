import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";
import MobileHeader from "./MobileHeader.jsx";
import PoweredByFooter from "./PoweredByFooter.jsx";
import { getCurrentPosition } from "../utils/geolocation.js";

export default function AppShell() {
  useEffect(() => {
    getCurrentPosition().catch(() => {});
  }, []);

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
