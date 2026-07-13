import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { arnavApi } from "../../api";
import { NAV_ITEMS } from "../../config/navItems.js";
import { usePermission } from "../../hooks/usePermission.js";
import { buildSessionNavItems } from "../../utils/permissions.js";
import {
  resolvePostLoginPath,
} from "../../utils/postLoginRedirect.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    applyLoginSession,
    clearSession,
    isAuthenticated,
    permissionsLoaded,
    modules,
    permissions,
    navItems,
  } = usePermission();

  const [loginMethod, setLoginMethod] = useState("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    location.state?.noAccess
      ? "Your account has no module access. Contact your administrator."
      : null
  );
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!permissionsLoaded || !isAuthenticated) {
      return;
    }

    const destination = resolvePostLoginPath({
      modules,
      permissions,
      fromPathname: location.state?.from?.pathname,
      navItems,
    });

    if (destination) {
      navigate(destination, { replace: true });
    }
  }, [
    isAuthenticated,
    permissionsLoaded,
    modules,
    permissions,
    navItems,
    location.state,
    navigate,
  ]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isOffline) {
      setError(
        "You are currently offline. Please connect to the internet to sign in."
      );
      return;
    }

    const loginPhone = loginMethod === "phone" ? identifier.trim() : undefined;
    const loginEmail =
      loginMethod === "email" ? identifier.trim().toLowerCase() : undefined;

    if (!loginPhone && !loginEmail) {
      setError(
        loginMethod === "email"
          ? "Enter a valid email address."
          : "Enter your phone number."
      );
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await arnavApi.login({
        phone: loginPhone,
        email: loginEmail,
        password,
      });

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      applyLoginSession({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        user: data.data.user,
        permissions: data.data.permissions || [],
        modules: data.data.modules || [],
      });

      const sessionPermissions = data.data.permissions || [];
      const sessionNavItems = buildSessionNavItems(
        sessionPermissions,
        NAV_ITEMS
      );

      const destination = resolvePostLoginPath({
        modules: data.data.modules || [],
        permissions: sessionPermissions,
        fromPathname: location.state?.from?.pathname,
        navItems: sessionNavItems,
      });

      if (!destination) {
        clearSession();
        setError(
          "Your account has no module access. Contact your administrator."
        );
        return;
      }

      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card">
        <p className="app-eyebrow">S21 Management System</p>
        <h1>Sign in</h1>
        <p className="page-description">
          Single login URL for all roles. You&apos;ll land on the first page your
          permissions allow.
        </p>

        {isOffline && (
          <div className="login-offline-banner">
            Offline mode — connect to the internet to sign in.
          </div>
        )}

        <div className="login-method-toggle" role="tablist" aria-label="Login method">
          <button
            type="button"
            role="tab"
            aria-selected={loginMethod === "phone"}
            className={loginMethod === "phone" ? "active" : ""}
            onClick={() => {
              setLoginMethod("phone");
              setIdentifier("");
              setError(null);
            }}
          >
            Phone
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMethod === "email"}
            className={loginMethod === "email" ? "active" : ""}
            onClick={() => {
              setLoginMethod("email");
              setIdentifier("");
              setError(null);
            }}
          >
            Email
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            {loginMethod === "phone" ? "Phone" : "Email"}
            <input
              type={loginMethod === "email" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={
                loginMethod === "phone" ? "10-digit phone number" : "name@salon.dev"
              }
              autoComplete={loginMethod === "phone" ? "tel" : "email"}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="status-error">{error}</p>}

          <button type="submit" disabled={loading || isOffline}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
