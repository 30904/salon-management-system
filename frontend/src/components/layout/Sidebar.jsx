import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { NAV_GROUP_LABELS } from "../../config/navItems.js";
import { HELP_SECTIONS } from "../../pages/help/helpContent.js";
import { useShell } from "../../context/ShellContext.jsx";
import { usePermission } from "../../hooks/usePermission.js";
import { NavIcon } from "./NavIcons.jsx";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed } = useShell();
  const { navItems, permissionsLoaded } = usePermission();
  const isHelpMode = location.pathname.startsWith("/help");

  const groupedItems = navItems.reduce((groups, item) => {
    const groupKey = item.group || "main";

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(item);
    return groups;
  }, {});

  const settingsItems = groupedItems.settings || [];
  const mainNavGroups = Object.entries(groupedItems).filter(
    ([groupKey]) => groupKey !== "settings",
  );

  const renderNavGroup = (groupKey, items) => (
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
            <NavIcon name={item.key} />
          </span>
          {!collapsed && (
            <span className="shell-nav-label">{item.label}</span>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="shell-brand">
        {collapsed ? (
          <div className="shell-brand-collapsed-logo" title="Salon 21 Family Salon">
            <img
              src="/salon21-logo.png"
              alt="Salon 21"
              style={{
                width: "40px",
                height: "40px",
                objectFit: "cover",
                objectPosition: "center",
                borderRadius: "50%",
                border: "2px solid rgba(212, 175, 55, 0.6)",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div className="shell-brand-full" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0.5rem 0.25rem 0.25rem" }}>
            <img
              src="/salon21-logo.png"
              alt="Salon 21 Family Salon"
              style={{
                width: "100%",
                maxWidth: "160px",
                height: "auto",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 2px 8px rgba(212,175,55,0.3))",
              }}
            />
            {isHelpMode && (
              <span className="shell-brand-subtext" style={{ marginTop: "0.25rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                Internal documentation
              </span>
            )}
          </div>
        )}
      </div>

      <nav
        className="shell-nav"
        aria-label={isHelpMode ? "Help centre navigation" : "Main navigation"}
      >
        {isHelpMode ? (
          <>
            <div className="shell-nav-scroll">
              <div className="shell-nav-group">
                {!collapsed ? (
                  <p className="shell-nav-group-label">Documentation</p>
                ) : null}

                {HELP_SECTIONS.map((section) => (
                  <NavLink
                    key={section.id}
                    to={section.path}
                    className={({ isActive }) =>
                      `shell-nav-link ${isActive ? "active" : ""}`
                    }
                    title={collapsed ? section.label : undefined}
                  >
                    <span className="shell-nav-icon" aria-hidden="true">
                      <NavIcon name={section.icon} />
                    </span>
                    {!collapsed && (
                      <span className="shell-nav-label">{section.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="shell-nav-footer">
              <button
                type="button"
                className="shell-nav-back"
                onClick={() => navigate("/dashboard")}
                title={collapsed ? "Back to app" : undefined}
              >
                <span className="shell-nav-icon" aria-hidden="true">
                  <NavIcon name="back" />
                </span>
                {!collapsed && (
                  <span className="shell-nav-label">Back to app</span>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {!permissionsLoaded && (
              <p className="shell-nav-loading">Loading menu…</p>
            )}

            {permissionsLoaded ? (
              <>
                <div className="shell-nav-scroll">
                  {mainNavGroups.map(([groupKey, items]) =>
                    renderNavGroup(groupKey, items),
                  )}
                </div>

                {settingsItems.length > 0 ? (
                  <div className="shell-nav-footer">
                    {renderNavGroup("settings", settingsItems)}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </nav>
    </aside>
  );
}
