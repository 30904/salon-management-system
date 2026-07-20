import { usePermissionContext } from "../context/PermissionContext.jsx";

export function usePermission() {
  return usePermissionContext();
}

export default usePermission;
