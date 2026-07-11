import { usePermissionContext } from "../context/PermissionContext.jsx";

export {
  normalizeModule,
  normalizeAction,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getViewableModules,
  canViewModule,
  filterNavItems,
} from "../utils/permissions.js";

/**
 * Central RBAC hook — reads session permissions from PermissionContext.
 */
export function usePermission() {
  const context = usePermissionContext();

  return {
    user: context.user,
    permissions: context.permissions,
    modules: context.modules,
    viewableModules: context.modules,
    permissionsLoaded: context.permissionsLoaded,
    navItems: context.navItems,
    isAuthenticated: context.isAuthenticated,
    hasPermission: context.hasPermission,
    hasAnyPermission: context.hasAnyPermission,
    hasAllPermissions: context.hasAllPermissions,
    canView: context.canView,
    refreshPermissions: context.refreshPermissions,
    clearSession: context.clearSession,
    applyLoginSession: context.applyLoginSession,
  };
}

export default usePermission;
