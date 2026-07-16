import axios from "axios";
import { isLatencyLoggingEnabled, logLatency } from "../utils/latencyLog.js";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";
const PERMISSIONS_KEY = "permissions";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (isLatencyLoggingEnabled()) {
    config.metadata = { startTime: performance.now() };
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function logApiLatency(responseOrError, isError = false) {
  const config = responseOrError.config;
  const startTime = config?.metadata?.startTime;

  if (!isLatencyLoggingEnabled() || startTime == null) {
    return;
  }

  const durationMs = performance.now() - startTime;
  const method = (config.method || "get").toUpperCase();
  const url = config.url || "";
  const params = config.params ? `?${new URLSearchParams(config.params)}` : "";
  const status = isError
    ? responseOrError.response?.status || "ERR"
    : responseOrError.status;

  logLatency("API", `${method} ${url}${params} — ${durationMs.toFixed(0)}ms`, {
    durationMs: Number(durationMs.toFixed(1)),
    status,
  });
}

let isRefreshing = false;
let refreshQueue = [];

function processQueue(error, token = null) {
  refreshQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  refreshQueue = [];
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMISSIONS_KEY);
}

apiClient.interceptors.response.use(
  (response) => {
    logApiLatency(response);
    return response;
  },
  async (error) => {
    logApiLatency(error, true);

    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes("/auth/login")) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      if (!data.success) {
        throw new Error(data.message || "Refresh failed");
      }

      const newAccessToken = data.data.accessToken;
      const newRefreshToken = data.data.refreshToken;

      localStorage.setItem(TOKEN_KEY, newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem(REFRESH_KEY, newRefreshToken);
      }

      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function setSession({ accessToken, refreshToken, user, permissions }) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  if (permissions) {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  }
}

export function clearAuthSession() {
  clearSession();
}

const inflightGetRequests = new Map();

function buildInflightGetKey(url, config = {}) {
  const params = config.params
    ? new URLSearchParams(config.params).toString()
    : "";
  return `GET:${url}?${params}`;
}

const originalGet = apiClient.get.bind(apiClient);

apiClient.get = function dedupedGet(url, config) {
  const key = buildInflightGetKey(url, config);

  if (inflightGetRequests.has(key)) {
    return inflightGetRequests.get(key);
  }

  const request = originalGet(url, config);
  inflightGetRequests.set(key, request);

  request.finally(() => {
    if (inflightGetRequests.get(key) === request) {
      inflightGetRequests.delete(key);
    }
  });

  return request;
};

export default apiClient;
