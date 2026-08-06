import React from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../hooks/usePermission.js";
import "./PayrollHome.css";

const EMPLOYEES_SALARY = [
  { id: 1, name: "Sarang", salary: 32000 },
  { id: 2, name: "Sai", salary: 22000 },
  { id: 3, name: "Sujit", salary: 17000 },
  { id: 4, name: "Shruti", salary: 17000 },
  { id: 5, name: "Mahi", salary: 15000 },
  { id: 6, name: "Neha", salary: 12000 },
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
    <div className="payroll-dashboard">
      <header className="payroll-dashboard-header">
        <h1>Payroll</h1>
      </header>

      <div className="payroll-content" style={{ padding: "0 24px 24px 24px" }}>
        <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <tr>
                <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: "600", color: "#475569", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee Name</th>
                <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: "600", color: "#475569", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly Salary (₹)</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES_SALARY.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "16px 24px", color: "#1e293b", fontWeight: "500" }}>{emp.name}</td>
                  <td style={{ padding: "16px 24px", color: "#334155" }}>₹ {emp.salary.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
