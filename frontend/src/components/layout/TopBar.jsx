import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../../api";
import { useShell } from "../../context/ShellContext.jsx";
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TopBar() {
  const navigate = useNavigate();
  const { collapsed, toggleSidebar, user } = useShell();
  const displayName = user?.name || "Guest";

  function handleLogout() {
    clearAuthSession();
    navigate("/login");
  }
  return (
    <header className="shell-topbar">
      <div className="shell-topbar-left">
        <button
          type="button"
          className="shell-icon-btn"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          ☰
        </button>
        <div className="shell-greeting">
          <p className="shell-greeting-eyebrow">{getGreeting()}</p>
          <h1 className="shell-greeting-title">{displayName}</h1>
        </div>
      </div>

      <div className="shell-topbar-right">
        <div className="shell-health-pill">Business health: —</div>
        <button type="button" className="shell-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
