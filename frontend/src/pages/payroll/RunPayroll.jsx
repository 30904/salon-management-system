import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./RunPayroll.css";

export default function RunPayroll() {
  const [monthYear, setMonthYear] = useState("");

  return (
    <div className="run-payroll-page">
      <header className="rp-header">
        <div className="rp-title-area">
          <Link to="/payroll" className="back-btn">
            &larr;
          </Link>
          <h2>Run Payroll</h2>
        </div>
      </header>

      <div className="rp-content">
        <div className="rp-toolbar">
          <div className="month-picker-wrapper">
            <input
              type="month"
              className="month-picker"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              placeholder="Select Month-Year"
            />
          </div>
        </div>

        <div className="rp-empty-state">
          <div className="rp-empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h6l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"
                fill="#d8b4fe"
                opacity="0.4"
              />
              <path
                d="M4 4h6l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"
                stroke="#c084fc"
                strokeWidth="1"
              />
              <rect x="9.5" y="10.5" width="5" height="5" rx="1" stroke="#a855f7" strokeWidth="1" fill="#fff" />
              <line x1="10.5" y1="11.5" x2="13.5" y2="14.5" stroke="#a855f7" strokeWidth="1" strokeLinecap="round" />
              <line x1="13.5" y1="11.5" x2="10.5" y2="14.5" stroke="#a855f7" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          <p>No records to display.</p>
        </div>
      </div>
    </div>
  );
}
