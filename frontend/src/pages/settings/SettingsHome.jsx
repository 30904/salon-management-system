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
    description: "Manage retail SKUs, stock inventory levels, and low-stock reorder thresholds in the integrated Inventory page.",
    path: "/inventory?tab=products",
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
    path: "#",
    module: "whatsapp",
  },
  
];

export default function SettingsHome() {
  const { canView } = usePermission();

  return (
    <div className="page settings-home-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Masters & Configuration</h1>
          <p>
            Configure core system masters, staff profiles, pricing catalogs, taxation, and communication rules.
          </p>
        </div>
      </header>

      <div className="module-panel-grid">
        {SETTINGS_CARDS.filter((item) => canView(item.module) || canView("settings")).map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className="module-link-card"
          >
            <div
              className="module-link-card__badge"
              style={{
                background: item.badgeBg,
                color: item.badgeColor,
              }}
            >
              {item.code}
            </div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
