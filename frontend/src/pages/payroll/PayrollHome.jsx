import React from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";
import "./PayrollHome.css";

const PAYROLL_COMPONENTS = [
  {
    id: "payroll-components",
    title: "Payroll Components",
    description: "Setup payroll components",
    disabled: false,
  },
  {
    id: "ctc-structure",
    title: "CTC Structure",
    description: "Setup Employee CTC",
    disabled: false,
  },
  {
    id: "run-payroll",
    title: "Run Payroll",
    description: "Run payroll for employees",
    disabled: false,
  },
];

const CalendarRupeeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
    <path d="M8 14h8"></path>
    <path d="M12 14v6"></path>
    <path d="M9 17h6"></path>
    <path d="M12 14c-1.5 0-3-1-3-2.5s1.5-2.5 3-2.5 3 1 3 2.5"></path>
  </svg>
);

export default function PayrollHome() {
  const navigate = useNavigate();
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
    <div className="payroll-dashboard">
      <header className="payroll-dashboard-header">
        <button className="payroll-back-btn" aria-label="Go back">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h1>Payroll</h1>
      </header>

      <div className="payroll-cards-grid">
        {PAYROLL_COMPONENTS.map((comp) => (
          <button
            key={comp.id}
            type="button"
            className={`payroll-card ${comp.disabled ? "disabled" : ""}`}
            disabled={comp.disabled}
            onClick={() => {
              if (!comp.disabled) {
                if (comp.id === "ctc-structure") {
                  navigate("/payroll/ctc-structure");
                } else if (comp.id === "run-payroll") {
                  navigate("/payroll/run");
                } else {
                  console.log(`Navigate to ${comp.title}`);
                }
              }
            }}
          >
            <div className="payroll-card-icon">
              <CalendarRupeeIcon />
            </div>
            <div className="payroll-card-content">
              <h3 className="payroll-card-title">{comp.title}</h3>
              <p className="payroll-card-desc">{comp.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
