import { Link } from "react-router-dom";
import PlaceholderPage from "../../components/PlaceholderPage.jsx";

export default function SettingsHome() {
  return (
    <div className="page" style={{ maxWidth: "900px" }}>
      <header className="page-header">
        <p className="app-eyebrow">Settings</p>
        <h1>Masters & Configuration</h1>
        <p className="page-description">Manage salon masters, staff profiles, commission slabs, and system setup.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "1.5rem" }}>
        <Link
          to="/settings/staff"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 8px 24px rgba(17, 24, 39, 0.04)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>💇‍♀️</div>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.4rem", color: "#1e1b4b" }}>Staff Master & Specializations</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
            Link system accounts, assign commission slabs, shifts, base salaries, and configure service specializations.
          </p>
        </Link>

        <Link
          to="/settings/attendance"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 8px 24px rgba(17, 24, 39, 0.04)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⏰</div>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.4rem", color: "#1e1b4b" }}>Shift Schedules Master</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
            Manage staff working shift rosters, start check-in times, and end check-out schedules.
          </p>
        </Link>


        <Link
          to="/settings/packages"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 8px 24px rgba(17, 24, 39, 0.04)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>🎁</div>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.4rem", color: "#1e1b4b" }}>Package & Membership Masters</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
            Define prepaid multi-sitting bundles, sitting credit quotas, and recurring VIP membership discount tiers.
          </p>
        </Link>

        <Link
          to="/settings/whatsapp/templates"
          style={{
            display: "block",
            padding: "1.5rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            textDecoration: "none",
            color: "inherit",
            boxShadow: "0 8px 24px rgba(17, 24, 39, 0.04)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>💬</div>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.4rem", color: "#1e1b4b" }}>WhatsApp Templates & Campaigns</h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
            Configure pre-approved message templates for automated notifications and marketing campaigns (Owner/Manager).
          </p>
        </Link>
      </div>
    </div>
  );
}

