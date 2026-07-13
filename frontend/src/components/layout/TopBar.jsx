import { useNavigate } from "react-router-dom";
import { useShell } from "../../context/ShellContext.jsx";
import { usePermission } from "../../hooks/usePermission.js";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function TopBar() {
  const navigate = useNavigate();
  const { collapsed, toggleSidebar } = useShell();
  const { user, clearSession } = usePermission();
  const displayName = user?.name || "Guest";
  const initials = getInitials(displayName) || "U";

  function handleLogout() {
    clearSession();
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

        <label className="shell-search">
          <span className="shell-search__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            placeholder="Search modules and pages"
            aria-label="Search modules and pages"
            disabled
          />
        </label>
      </div>

      <div className="shell-topbar-right">
        <div className="shell-user-chip">
          <span className="shell-user-avatar">{initials}</span>
          <div className="shell-user-copy">
            <strong>{displayName}</strong>
            <span>{user?.role?.name || "User"}</span>
          </div>
        </div>

        <button type="button" className="shell-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
