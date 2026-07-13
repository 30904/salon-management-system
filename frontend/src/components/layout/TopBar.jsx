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
];

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
  const { user, clearSession, navItems, canView } = usePermission();
  const displayName = user?.name || "Guest";
  const roleName = user?.role?.name || "User";
  const userEmail = user?.email || user?.phone || "—";
  const initials = getInitials(displayName) || "U";

  const searchRef = useRef(null);
  const userMenuRef = useRef(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchablePages = useMemo(() => {
    const navPages = navItems.map((item) => ({
      key: item.key,
      label: item.label,
      path: item.path,
      group: "Modules",
      keywords: "",
    }));

    const extraPages = EXTRA_PAGES.filter((page) => canView(page.module)).map(
      (page) => ({ ...page, group: "Pages" })
    );

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

  function toggleUserMenu() {
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

        <div className="shell-search-wrap" ref={searchRef}>
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
      </div>

      <div className="shell-topbar-right">
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
