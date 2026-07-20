import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi, clearAuthSession } from "../api/index.js";
import {
  canViewModule,
  getViewableModules,
  hasPermission as checkPermission,
  isOwnerRole,
} from "../utils/permissions.js";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [modules, setModules] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const applyLoginSession = useCallback((payload) => {
    authApi.saveAuthSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
      permissions: payload.permissions || [],
    });

    setUser(payload.user);
    setPermissions(payload.permissions || []);
    setModules(payload.modules || getViewableModules(payload.permissions || []));
    setPermissionsLoaded(true);
  }, []);

  const clearSession = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setPermissions([]);
    setModules([]);
    setPermissionsLoaded(true);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      clearSession();
      return null;
    }

    const data = await authApi.getMe();

    if (data.success) {
      setUser(data.data.user);
      setPermissions(data.data.permissions || []);
      setModules(data.data.modules || getViewableModules(data.data.permissions || []));
      localStorage.setItem("user", JSON.stringify(data.data.user));
      localStorage.setItem("permissions", JSON.stringify(data.data.permissions || []));
    }

    return data;
  }, [clearSession]);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    const storedPermissions = authApi.readStoredPermissions();
    const hasCachedSession = Boolean(token && storedUser && storedPermissions.length > 0);

    if (storedPermissions.length > 0) {
      setPermissions(storedPermissions);
      setModules(getViewableModules(storedPermissions));
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

    if (hasCachedSession) {
      setPermissionsLoaded(true);
      refreshPermissions().catch(() => {});
      return;
    }

    try {
      await refreshPermissions();
    } catch {
      // keep cached session until token expires
    } finally {
      setPermissionsLoaded(true);
    }
  }, [refreshPermissions]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const isAuthenticated = Boolean(user && localStorage.getItem("accessToken"));
  const isOwner = useMemo(() => isOwnerRole(permissions), [permissions]);

  const value = useMemo(
    () => ({
      user,
      permissions,
      modules,
      permissionsLoaded,
      isAuthenticated,
      isOwner,
      applyLoginSession,
      clearSession,
      refreshPermissions,
      hasPermission: (module, action = "view") => checkPermission(permissions, module, action),
      canView: (module) => canViewModule(permissions, module),
    }),
    [
      user,
      permissions,
      modules,
      permissionsLoaded,
      isAuthenticated,
      isOwner,
      applyLoginSession,
      clearSession,
      refreshPermissions,
    ]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissionContext() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error("usePermissionContext must be used within PermissionProvider");
  }

  return context;
}

export default PermissionContext;
