import { NavLink } from "react-router-dom";
import { useShell } from "../../context/ShellContext.jsx";

export default function Sidebar() {
  const { collapsed, navItems } = useShell();

  return (
    <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="shell-brand">
        <span className="shell-brand-mark">S21</span>
        {!collapsed && <span className="shell-brand-text">Salon System</span>}
      </div>

      <nav className="shell-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `shell-nav-link ${isActive ? "active" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="shell-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {!collapsed && <span className="shell-nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
