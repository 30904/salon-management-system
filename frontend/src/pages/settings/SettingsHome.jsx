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
