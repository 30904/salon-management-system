import React from "react";
import { Link } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";

const SETTINGS_CARDS = [
  {
    key: "services",
    icon: "💇‍♂️",
    title: "Service Master",
    description: "Manage service categories, durations, pricing, and commission overrides.",
    path: "/settings/services",
    module: "settings",
  },
  {
    key: "products",
    icon: "🛍️",
    title: "Product Master",
    description: "Manage retail SKUs, stock inventory levels, and low-stock reorder thresholds.",
    path: "/settings/products",
    module: "settings",
  },
  {
    key: "tax",
    icon: "🧾",
    title: "Tax / GST Master",
    description: "Configure separate GST and tax slabs for salon services and retail products.",
    path: "/settings/tax",
    module: "settings",
  },
  {
    key: "staff",
    icon: "💇‍♀️",
    title: "Staff Master & Specializations",
    description: "Link system accounts, assign commission slabs, shifts, base salaries, and configure service specializations.",
    path: "/settings/staff",
    module: "staff",
  },
  {
    key: "shifts",
    icon: "⏰",
    title: "Shift Schedules Master",
    description: "Manage staff working shift rosters, start check-in times, and end check-out schedules.",
    path: "/settings/attendance",
    module: "attendance",
  },
  {
    key: "packages",
    icon: "🎁",
    title: "Package & Membership Masters",
    description: "Define prepaid multi-sitting bundles, sitting credit quotas, and recurring VIP membership discount tiers.",
    path: "/settings/packages",
    module: "packages",
  },
  {
    key: "whatsapp",
    icon: "💬",
    title: "WhatsApp Templates & Campaigns",
    description: "Configure pre-approved message templates for automated notifications and marketing campaigns (Owner/Manager).",
    path: "/settings/whatsapp/templates",
    module: "whatsapp",
  },
];

export default function SettingsHome() {
  const { canView } = usePermission();

  return (
    <div className="page settings-home-page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem" }}>
      <header className="page-header" style={{ marginBottom: "2rem" }}>
        <p className="app-eyebrow" style={{ textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 700, color: "#6366f1", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
          Settings & Masters
        </p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem" }}>
          Masters & Configuration
        </h1>
        <p className="page-description" style={{ fontSize: "1rem", color: "#64748b", margin: 0 }}>
          Configure core system masters, staff profiles, pricing catalogs, taxation, and communication rules.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {SETTINGS_CARDS.filter((item) => canView(item.module) || canView("settings")).map((item) => (
          <Link
            key={item.key}
            to={item.path}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "1.75rem",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              textDecoration: "none",
              color: "inherit",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 12px 20px -3px rgba(0, 0, 0, 0.08)";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>{item.icon}</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#1e293b" }}>
              {item.title}
            </h2>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#64748b" }}>
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
