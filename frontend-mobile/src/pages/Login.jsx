import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/index.js";
import { usePermission } from "../hooks/usePermission.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyLoginSession } = usePermission();

  const [loginMethod, setLoginMethod] = useState("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter your login and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login({
        phone: loginMethod === "phone" ? identifier.trim() : undefined,
        email: loginMethod === "email" ? identifier.trim().toLowerCase() : undefined,
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

      navigate(location.state?.from?.pathname || "/home", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-brand">
        <div className="login-logo">S21</div>
        <h1>S21 Salon</h1>
        <p>Sign in to punch in, check earnings and your schedule.</p>
      </div>

      <form className="login-form-card" onSubmit={handleSubmit}>
        <div className="segmented">
          <button
            type="button"
            className={loginMethod === "phone" ? "is-active" : ""}
            onClick={() => {
              setLoginMethod("phone");
              setIdentifier("");
            }}
          >
            Phone
          </button>
          <button
            type="button"
            className={loginMethod === "email" ? "is-active" : ""}
            onClick={() => {
              setLoginMethod("email");
              setIdentifier("");
            }}
          >
            Email
          </button>
        </div>

        <label className="field">
          <span>{loginMethod === "phone" ? "Phone number" : "Email"}</span>
          <input
            type={loginMethod === "email" ? "email" : "text"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={loginMethod === "phone" ? "10-digit phone" : "name@salon.dev"}
            autoComplete={loginMethod === "phone" ? "tel" : "email"}
            inputMode={loginMethod === "phone" ? "tel" : "email"}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
