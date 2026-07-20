import { NavLink } from "react-router-dom";
import { NAV_ITEMS, OWNER_NAV_ITEMS } from "../config/navItems.js";
import { usePermission } from "../hooks/usePermission.js";

const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  wallet: "M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  team: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2.2 1.5-4 4-4.6M16 15.4C18.5 16 22 17.8 22 20",
};
ICONS.user = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9c0-3.9 3.1-7 7-7s7 3.1 7 7";

function Icon({ name }) {
  const path = ICONS[name] || ICONS.home;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BottomNav() {
  const { isOwner } = usePermission();
  const items = isOwner ? OWNER_NAV_ITEMS : NAV_ITEMS;

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item ${isActive ? "is-active" : ""}`}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
