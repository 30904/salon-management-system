import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { arnavApi } from "../../api";

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("9999999999");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (isOffline) {
      setError("You are currently offline. Please connect to the internet to sign in.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data = await arnavApi.login({ phone, password });

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      arnavApi.saveAuthSession({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        user: data.data.user,
        permissions: data.data.permissions || [],
      });
      navigate("/dashboard", { replace: true });
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
        <p className="page-description">Single login for all roles.</p>
        {isOffline && (
          <div style={{
            background: "#450a0a",
            color: "#fecaca",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            border: "1px solid #7f1d1d"
          }}>
            ⚠️ Offline Mode — Login Shell Ready
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Phone
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </label>

          {error && <p className="status-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
