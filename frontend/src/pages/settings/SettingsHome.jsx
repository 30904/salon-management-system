import React from "react";
import { Link } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";

const SETTINGS_CARDS = [
  {
    key: "excel-upload",
    code: "XLS",
    badgeBg: "#eef2ff",
    badgeColor: "#4338ca",
    title: "Upload Excel",
    description: "Bulk import master data — services, products, staff, customers, tax, packages, and more via spreadsheet templates.",
    path: "/settings/excel-upload",
    module: "settings",
  },
  
  {
    key: "services",
    code: "SVC",
    badgeBg: "#eff6ff",
    badgeColor: "#2563eb",
    title: "Service Master",
    description: "Manage service categories, durations, pricing, and commission overrides.",
    path: "/settings/services",
    module: "settings",
  },
  {
    key: "products",
    code: "PRD",
    badgeBg: "#fdf4ff",
    badgeColor: "#c026d3",
    title: "Product Master",
    description: "Manage retail SKUs, stock inventory levels, and low-stock reorder thresholds.",
    path: "/settings/products",
    module: "settings",
  },
  {
    key: "tax",
    code: "GST",
    badgeBg: "#f0fdf4",
    badgeColor: "#16a34a",
    title: "Tax / GST Master",
    description: "Configure separate GST and tax slabs for salon services and retail products.",
    path: "/settings/tax",
    module: "settings",
  },
  {
    key: "staff",
    code: "STF",
    badgeBg: "#fff7ed",
    badgeColor: "#ea580c",
    title: "Staff Master & Specializations",
    description: "Link system accounts, assign commission slabs, shifts, base salaries, and configure service specializations.",
    path: "/settings/staff",
    module: "staff",
  },
  {
    key: "shifts",
    code: "ATT",
    badgeBg: "#f1f5f9",
    badgeColor: "#475569",
    title: "Shift Schedules Master",
    description: "Manage staff working shift rosters, start check-in times, and end check-out schedules.",
    path: "/settings/attendance",
    module: "attendance",
  },
  {
    key: "packages",
    code: "PKG",
    badgeBg: "#fef2f2",
    badgeColor: "#e11d48",
    title: "Package & Membership Masters",
    description: "Define prepaid multi-sitting bundles, sitting credit quotas, and recurring VIP membership discount tiers.",
    path: "/settings/packages",
    module: "packages",
  },
  {
    key: "whatsapp",
    code: "WSP",
    badgeBg: "#ecfdf5",
    badgeColor: "#059669",
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
              e.preferredStyle = { ...e.currentTarget.style };
              e.currentTarget.style.boxShadow = "0 12px 20px -3px rgba(0, 0, 0, 0.08)";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: item.badgeBg,
                color: item.badgeColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
                marginBottom: "1.25rem",
              }}
            >
              {item.code}
            </div>
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
