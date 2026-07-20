import { Link } from "react-router-dom";

export default function MobileHeader({ notificationCount = 0 }) {
  return (
    <header className="mobile-header">
      <Link to="/profile" className="mobile-header__menu" aria-label="Menu">
        <span />
        <span />
        <span />
      </Link>

      <div className="mobile-header__brand">
        <span className="mobile-header__brand-mark">S21</span>
        <span className="mobile-header__brand-name">Salon</span>
      </div>

      <button type="button" className="mobile-header__bell" aria-label="Notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V4a2 2 0 1 0-4 0v.29A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
        </svg>
        {notificationCount > 0 ? (
          <span className="mobile-header__badge">{notificationCount}</span>
        ) : null}
      </button>
    </header>
  );
}
