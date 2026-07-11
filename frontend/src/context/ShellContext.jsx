import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { arnavApi } from "../api";
import { filterNavItems } from "../hooks/usePermission.js";
import { NAV_ITEMS } from "../config/navItems.js";

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    const storedPermissions = arnavApi.readStoredPermissions();

    if (storedPermissions.length > 0) {
      setPermissions(storedPermissions);
      setPermissionsLoaded(true);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    if (!token) {
      setPermissionsLoaded(true);
      return;
    }

    arnavApi
      .getMe()
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
          setPermissions(data.data.permissions || []);
          localStorage.setItem("user", JSON.stringify(data.data.user));
          localStorage.setItem(
            "permissions",
            JSON.stringify(data.data.permissions || [])
          );
        }
      })
      .catch(() => {
        // Keep local user fallback until session expires
      })
      .finally(() => {
        setPermissionsLoaded(true);
      });
  }, []);

  const navItems = useMemo(
    () => filterNavItems(NAV_ITEMS, permissions, { permissionsLoaded }),
    [permissions, permissionsLoaded]
  );

  const value = {
    collapsed,
    setCollapsed,
    toggleSidebar: () => setCollapsed((prev) => !prev),
    user,
    permissions,
    permissionsLoaded,
    navItems,
  };

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return context;
}
