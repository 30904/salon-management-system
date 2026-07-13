import { Link } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";

const SETTINGS_LINKS = [
  {
    key: "services",
    title: "Services",
    description: "Categories, duration, price, and commission overrides.",
    path: "/settings/services",
    module: "settings",
  },
  {
    key: "products",
    title: "Products",
    description: "Retail SKUs, stock levels, and reorder thresholds.",
    path: "/settings/products",
    module: "settings",
  },
  {
    key: "tax",
    title: "Tax / GST",
    description: "Separate GST rates for services and products.",
    path: "/settings/tax",
    module: "settings",
  },
  {
    key: "staff",
    title: "Staff Master",
    description:
      "Link accounts, commission slabs, shifts, salaries, and specializations.",
    path: "/settings/staff",
    module: "settings",
  },
  {
    key: "attendance",
    title: "Shift Schedules",
    description: "Manage shift rosters, check-in times, and check-out schedules.",
    path: "/settings/attendance",
    module: "settings",
  },
  {
    key: "packages",
    title: "Packages & Memberships",
    description: "Prepaid bundles, credit quotas, and membership discount tiers.",
    path: "/settings/packages",
    module: "settings",
  },
  {
    key: "whatsapp",
    title: "WhatsApp Templates",
    description: "Pre-approved message templates for notifications and campaigns.",
    path: "/settings/whatsapp/templates",
    module: "settings",
  },
];

export default function SettingsHome() {
  const { canView } = usePermission();

  return (
    <div className="page settings-home-page">
      <header className="page-header">
        <p className="app-eyebrow">Settings</p>
        <h1>Masters & configuration</h1>
        <p className="page-description">
          Service, product, tax, staff, and package masters.
        </p>
      </header>

      <section className="settings-link-grid">
        {SETTINGS_LINKS.filter((item) => canView(item.module)).map((item) => (
          <Link key={item.key} to={item.path} className="settings-link-card">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
