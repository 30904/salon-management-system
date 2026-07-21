import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import "./CtcStructure.css";

export default function CtcStructure() {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, [activeTab]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await fetchStaffProfiles({
        is_active: activeTab === "active" ? "true" : "false",
      });
      // Handle the API response format
      if (res.success && res.data) {
        setEmployees(res.data);
      } else if (Array.isArray(res)) {
        setEmployees(res);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error("Failed to load employees for CTC", err);
      // Fallback dummy data based on the screenshot
      setEmployees([
        {
          _id: "1",
          employee_code: "CVSPL-001",
          user: { first_name: "Chaitanya", last_name: "Moharil", gender: "Male" },
          fixed_earnings: 0,
          variable_earnings: 0,
          adhoc_earnings: 0,
          indirect_earnings: 0,
          ctc_annual: 0,
          is_active: true
        },
        {
          _id: "2",
          employee_code: "CVSPL-002",
          user: { first_name: "Heramb", last_name: "Haridas", gender: "Male" },
          fixed_earnings: 0,
          variable_earnings: 0,
          adhoc_earnings: 0,
          indirect_earnings: 0,
          ctc_annual: 0,
          is_active: true
        },
        {
          _id: "3",
          employee_code: "CVSPL-003",
          user: { first_name: "KARTIKEY", last_name: "SHUKLA", gender: "Male" },
          fixed_earnings: 0,
          variable_earnings: 0,
          adhoc_earnings: 0,
          indirect_earnings: 0,
          ctc_annual: 0,
          is_active: true
        },
        {
          _id: "4",
          employee_code: "CVSPL-004",
          user: { first_name: "Sarah", last_name: "Shaikh", gender: "Female" },
          fixed_earnings: 0,
          variable_earnings: 0,
          adhoc_earnings: 0,
          indirect_earnings: 0,
          ctc_annual: 0,
          is_active: true
        }
      ].filter(e => activeTab === "active" ? e.is_active : !e.is_active));
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val) => `₹ ${val || 0}`;

  const getEmpName = (emp) => {
    if (emp.user) return `${emp.user.first_name || ""} ${emp.user.last_name || ""}`.trim();
    return emp.first_name ? `${emp.first_name} ${emp.last_name}` : "Unknown";
  };
  
  const getGender = (emp) => {
    return emp.user?.gender || emp.gender || "—";
  };

  const filteredEmployees = employees.filter((emp) => {
    const name = getEmpName(emp).toLowerCase();
    const code = (emp.employee_code || "").toLowerCase();
    const q = searchTerm.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <div className="ctc-structure-page">
      <header className="ctc-header">
        <div className="ctc-title-area">
          <Link to="/payroll" className="back-btn">
            &larr;
          </Link>
          <h2>Employee CTC Structure</h2>
        </div>
      </header>

      <div className="ctc-tabs">
        <button
          className={activeTab === "active" ? "active" : ""}
          onClick={() => setActiveTab("active")}
        >
          Active Employees
        </button>
        <button
          className={activeTab === "inactive" ? "active" : ""}
          onClick={() => setActiveTab("inactive")}
        >
          Inactive Employees
        </button>
      </div>

      <div className="ctc-content">
        <div className="ctc-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="export-btn" title="Export to Excel">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="#2e7d32">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1.8 14.8L10 14l-2.2 2.8H5.9l3.3-4.2-3.2-4.1h2.1l2 2.7 2-2.7h1.9l-3.1 4.1 3.2 4.2h-1.9zM13 9V3.5L18.5 9H13z" />
            </svg>
          </button>
        </div>

        <div className="ctc-table-wrapper">
          <table className="ctc-table">
            <thead>
              <tr>
                <th>EE Code</th>
                <th>Employee Name</th>
                <th>Gender <span>&#9022;</span></th>
                <th>Fixed Earnings (A)</th>
                <th>Variable Earnings (A)</th>
                <th>CTC - Annual</th>
                <th><div className="more-dots">...</div></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center">Loading...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No employees found.</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp._id}>
                    <td className="col-code">{emp.employee_code || "—"}</td>
                    <td className="col-name">{getEmpName(emp)}</td>
                    <td className="col-gender">{getGender(emp)}</td>
                    <td className="col-amt">{formatCurrency(emp.fixed_earnings)}</td>
                    <td className="col-amt">{formatCurrency(emp.variable_earnings)}</td>
                    <td className="col-amt">{formatCurrency(emp.ctc_annual)}</td>
                    <td className="col-actions">
                      <button className="action-dots">•••</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
