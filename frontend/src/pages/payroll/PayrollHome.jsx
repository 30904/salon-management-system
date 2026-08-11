import { Link } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";

const PAYROLL_CARDS = [
  {
    key: "run",
    code: "RUN",
    badgeBg: "#ecfdf5",
    badgeColor: "#0f766e",
    title: "Run payroll",
    description: "Generate a draft for a month, review staff entries, then finalize.",
    path: "/payroll/run",
  },
  {
    key: "ctc",
    code: "CTC",
    badgeBg: "#eff6ff",
    badgeColor: "#2563eb",
    title: "Employee CTC",
    description: "View staff CTC structure used as base salary for payroll.",
    path: "/payroll/ctc-structure",
  },
];

export default function PayrollHome() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("payroll", "view");

  if (!canView) {
    return (
      <div className="page access-denied-page">
        <div className="access-denied-card">
          <h1>Access denied</h1>
          <p className="page-note">You don’t have permission to view payroll.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-home-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Payroll</h1>
          <p>Direct-pay runs: base salary minus unpaid-day deduction plus commission.</p>
        </div>
      </header>

      <div className="module-panel-grid">
        {PAYROLL_CARDS.map((item) => (
          <Link key={item.key} to={item.path} className="module-link-card">
            <div
              className="module-link-card__badge"
              style={{ background: item.badgeBg, color: item.badgeColor }}
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
