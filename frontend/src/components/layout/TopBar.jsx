import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShell } from "../../context/ShellContext.jsx";
import { usePermission } from "../../hooks/usePermission.js";

/** Searchable sub-pages that don't appear in the sidebar nav. */
const EXTRA_PAGES = [
  {
    key: "settings-services",
    label: "Services master",
    path: "/settings/services",
    module: "settings",
    keywords: "service category duration price",
  },
  {
    key: "settings-products",
    label: "Products master",
    path: "/settings/products",
    module: "settings",
    keywords: "product sku stock reorder retail",
  },
  {
    key: "settings-tax",
    label: "Tax / GST master",
    path: "/settings/tax",
    module: "settings",
    keywords: "tax gst rate",
  },
  {
    key: "settings-staff",
    label: "Staff master",
    path: "/settings/staff",
    module: "settings",
    keywords: "staff specialization commission salary",
  },
  {
    key: "settings-attendance",
    label: "Shift schedules",
    path: "/settings/attendance",
    module: "settings",
    keywords: "shift roster attendance rules",
  },
  {
    key: "settings-packages",
    label: "Packages & memberships",
    path: "/settings/packages",
    module: "settings",
    keywords: "package membership prepaid credits",
  },
  {
    key: "settings-whatsapp",
    label: "WhatsApp templates",
    path: "/settings/whatsapp/templates",
    module: "settings",
    keywords: "whatsapp template message campaign",
  },
  {
    key: "users-new",
    label: "Add user",
    path: "/users/new",
    module: "users",
    keywords: "create user account invite",
  },
  {
    key: "help-centre",
    label: "Help Centre",
    path: "/help",
    keywords: "help centre docs documentation guide",
  },
];

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning ,";
  if (hour < 17) return "Good afternoon ,";
  return "Good evening ,";
}

function HelpQuestionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.5 9.2a2.6 2.6 0 0 1 5.1.8c0 1.6-2.4 2.1-2.4 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function HelpBookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TopBar() {
  const navigate = useNavigate();
  const { collapsed, toggleSidebar } = useShell();
  const { user, clearSession, navItems, canView } = usePermission();
  const displayName = user?.name || "Guest";
  const roleName = user?.role?.name || "User";
  const userEmail = user?.email || user?.phone || "—";
  const initials = getInitials(displayName) || "U";

  const searchRef = useRef(null);
  const helpMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchablePages = useMemo(() => {
    const navPages = navItems.map((item) => ({
      key: item.key,
      label: item.label,
      path: item.path,
      group: "Modules",
      keywords: "",
    }));

    const extraPages = EXTRA_PAGES.filter(
      (page) => !page.module || canView(page.module)
    ).map((page) => ({ ...page, group: "Pages" }));

    return [...navPages, ...extraPages];
  }, [navItems, canView]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return [];
    }

    return searchablePages
      .filter(
        (page) =>
          page.label.toLowerCase().includes(term) ||
          page.keywords.toLowerCase().includes(term) ||
          page.path.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [query, searchablePages]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!searchRef.current?.contains(event.target)) {
        setShowResults(false);
      }

      if (!helpMenuRef.current?.contains(event.target)) {
        setHelpMenuOpen(false);
      }

      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openResult(page) {
    setQuery("");
    setShowResults(false);
    navigate(page.path);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setShowResults(false);
      event.currentTarget.blur();
      return;
    }

    if (!results.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openResult(results[activeIndex] || results[0]);
    }
  }

  function handleLogout() {
    setUserMenuOpen(false);
    clearSession();
    navigate("/login");
  }

  function toggleHelpMenu() {
    setUserMenuOpen(false);
    setHelpMenuOpen((open) => !open);
  }

  function openHelpCentre() {
    setHelpMenuOpen(false);
    navigate("/help");
  }

  function handleHelpMenuKeyDown(event) {
    if (event.key === "Escape") {
      setHelpMenuOpen(false);
    }
  }

  function toggleUserMenu() {
    setHelpMenuOpen(false);
    setUserMenuOpen((open) => !open);
  }

  function handleUserMenuKeyDown(event) {
    if (event.key === "Escape") {
      setUserMenuOpen(false);
    }
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

        <div className="shell-topbar-welcome">
          <p className="shell-topbar-welcome__eyebrow">{getGreeting()}</p>
          <h1 className="shell-topbar-welcome__title">{displayName}</h1>
        </div>
      </div>

      <div className="shell-topbar-right">
        <div className="shell-search-wrap shell-search-wrap--right" ref={searchRef}>
          <label className="shell-search">
            <span className="shell-search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search modules and pages"
              aria-label="Search modules and pages"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-expanded={showResults && results.length > 0}
              aria-autocomplete="list"
            />
          </label>

          {showResults && query.trim() ? (
            <div className="shell-search-results" role="listbox">
              {results.length === 0 ? (
                <p className="shell-search-empty">No pages match “{query.trim()}”.</p>
              ) : (
                results.map((page, index) => (
                  <button
                    key={page.key}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`shell-search-result ${
                      index === activeIndex ? "active" : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(page)}
                  >
                    <span className="shell-search-result__label">{page.label}</span>
                    <span className="shell-search-result__meta">
                      {page.group} · {page.path}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="shell-help-menu" ref={helpMenuRef}>
          <button
            type="button"
            className="shell-icon-btn shell-help-btn"
            onClick={toggleHelpMenu}
            onKeyDown={handleHelpMenuKeyDown}
            aria-expanded={helpMenuOpen}
            aria-haspopup="menu"
            aria-label="Open help menu"
          >
            <HelpQuestionIcon />
          </button>

          {helpMenuOpen ? (
            <div className="shell-help-dropdown" role="menu">
              <button
                type="button"
                className="shell-help-dropdown__item"
                role="menuitem"
                onClick={openHelpCentre}
              >
                <span className="shell-help-dropdown__icon" aria-hidden="true">
                  <HelpBookIcon />
                </span>
                Help Centre
              </button>
            </div>
          ) : null}
        </div>

        <div className="shell-user-menu" ref={userMenuRef}>
          <button
            type="button"
            className="shell-user-chip shell-user-chip--trigger"
            onClick={toggleUserMenu}
            onKeyDown={handleUserMenuKeyDown}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label="Open account menu"
          >
            <span className="shell-user-avatar">{initials}</span>
            <div className="shell-user-copy">
              <strong>{displayName}</strong>
              <span>{roleName}</span>
            </div>
          </button>

          {userMenuOpen ? (
            <div className="shell-user-dropdown" role="menu">
              <div className="shell-user-dropdown__profile">
                <span className="shell-user-avatar shell-user-avatar--dropdown">
                  {initials}
                </span>
                <div className="shell-user-dropdown__copy">
                  <strong>{displayName}</strong>
                  <span className="shell-user-dropdown__role">{roleName}</span>
                  <span className="shell-user-dropdown__email">{userEmail}</span>
                </div>
              </div>

              <div className="shell-user-dropdown__divider" aria-hidden="true" />

              <button
                type="button"
                className="shell-user-dropdown__logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <span className="shell-user-dropdown__logout-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 17l5-5-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12H9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
