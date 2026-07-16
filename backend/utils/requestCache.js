import { createTtlCache } from "./ttlCache.js";

const userCache = createTtlCache({ ttlMs: 60_000, maxSize: 300 });
const permissionCache = createTtlCache({ ttlMs: 60_000, maxSize: 300 });
const rolePermissionCache = createTtlCache({ ttlMs: 5 * 60_000, maxSize: 100 });
const dashboardCache = createTtlCache({ ttlMs: 45_000, maxSize: 100 });
const staffListCache = createTtlCache({ ttlMs: 60_000, maxSize: 50 });

export function getCachedUser(userId) {
  return userCache.get(String(userId));
}

export function setCachedUser(userId, user) {
  userCache.set(String(userId), user);
}

export function invalidateUserCache(userId) {
  userCache.delete(String(userId));
}

export function getCachedPermissions(userId) {
  return permissionCache.get(String(userId));
}

export function setCachedPermissions(userId, permissions) {
  permissionCache.set(String(userId), permissions);
}

export function invalidatePermissionCache(userId) {
  permissionCache.delete(String(userId));
}

export function getCachedRolePermissions(roleId) {
  return rolePermissionCache.get(String(roleId));
}

export function setCachedRolePermissions(roleId, permissions) {
  rolePermissionCache.set(String(roleId), permissions);
}

export function getCachedDashboard(cacheKey) {
  return dashboardCache.get(cacheKey);
}

export function setCachedDashboard(cacheKey, payload) {
  dashboardCache.set(cacheKey, payload);
}

export function getCachedStaffList(cacheKey) {
  return staffListCache.get(cacheKey);
}

export function setCachedStaffList(cacheKey, payload) {
  staffListCache.set(cacheKey, payload);
}
