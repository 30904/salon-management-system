import { Outlet } from "react-router-dom";
import { ShellProvider } from "../../context/ShellContext.jsx";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import PoweredByFooter from "./PoweredByFooter.jsx";
import "./layout.css";

export default function Layout() {
  return (
    <ShellProvider>
      <div className="shell-root">
        <Sidebar />
        <div className="shell-main">
          <TopBar />
          <main className="shell-content">
            <div className="shell-content-body">
              <Outlet />
            </div>
            <PoweredByFooter />
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
