import { useNavigate } from "react-router-dom";
import InstallAppCard from "../components/InstallAppCard.jsx";
import { usePermission } from "../hooks/usePermission.js";
import { readEntityLabel } from "../utils/format.js";

export default function Profile() {
  const { user, clearSession } = usePermission();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="page-pad">
      <h1>Profile</h1>

      <section className="status-card">
        <p className="card-label">Name</p>
        <strong>{user?.name || "—"}</strong>
        <p className="card-label" style={{ marginTop: 12 }}>Role</p>
        <strong>{readEntityLabel(user?.role_id, readEntityLabel(user?.role, "—"))}</strong>
        <p className="card-label" style={{ marginTop: 12 }}>Branch</p>
        <strong>{readEntityLabel(user?.branch_id, readEntityLabel(user?.branch, "—"))}</strong>
      </section>

      <InstallAppCard />

      <button type="button" className="btn btn-danger btn-block" onClick={handleLogout}>
        Log out
      </button>

      <p className="muted app-version">S21 Salon · v0.1.0</p>
    </div>
  );
}
