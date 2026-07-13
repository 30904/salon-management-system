import { NavLink } from "react-router-dom";
import { NAV_GROUP_LABELS } from "../../config/navItems.js";
import { useShell } from "../../context/ShellContext.jsx";
import { usePermission } from "../../hooks/usePermission.js";

export default function Sidebar() {
  const { collapsed } = useShell();
  const { navItems, permissionsLoaded } = usePermission();

  const groupedItems = navItems.reduce((groups, item) => {
    const groupKey = item.group || "main";

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(item);
    return groups;
  }, {});

  return (
    <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="shell-brand">
        <span className="shell-brand-mark">S21</span>
        {!collapsed && (
          <div className="shell-brand-copy">
            <span className="shell-brand-text">S21 Salon</span>
            <span className="shell-brand-subtext">Management System</span>
          </div>
        )}
      </div>

      <nav className="shell-nav" aria-label="Main navigation">
        {!permissionsLoaded && (
          <p className="shell-nav-loading">Loading menu…</p>
        )}

        {Object.entries(groupedItems).map(([groupKey, items]) => (
          <div key={groupKey} className="shell-nav-group">
            {!collapsed ? (
              <p className="shell-nav-group-label">
                {NAV_GROUP_LABELS[groupKey] || groupKey}
              </p>
            ) : null}

            {items.map((item) => (
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
                {!collapsed && (
                  <span className="shell-nav-label">{item.label}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
