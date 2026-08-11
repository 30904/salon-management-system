import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { formatInr } from "../../utils/earningsFormat.js";

function getEmpName(emp) {
  if (emp?.user?.name) return emp.user.name;
  const fromParts = `${emp?.user?.first_name || emp?.first_name || ""} ${
    emp?.user?.last_name || emp?.last_name || ""
  }`.trim();
  return fromParts || "Staff";
}

function getGender(emp) {
  return emp?.user?.gender || emp?.gender || "—";
}

function monthlySalary(emp) {
  return Number(emp?.base_salary ?? emp?.fixed_earnings ?? 0);
}

function annualCtc(emp) {
  if (emp?.ctc_annual != null) return Number(emp.ctc_annual);
  return monthlySalary(emp) * 12;
}

export default function CtcStructure() {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      setLoading(true);
      setError("");
      try {
        const res = await fetchStaffProfiles({
          is_active: activeTab === "active" ? "true" : "false",
        });
        const rows = res.success && res.data ? res.data : Array.isArray(res) ? res : [];
        if (!cancelled) setEmployees(rows);
      } catch (err) {
        if (!cancelled) {
          setEmployees([]);
          setError(err.response?.data?.message || err.message || "Failed to load CTC");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const filteredEmployees = employees.filter((emp) => {
    const name = getEmpName(emp).toLowerCase();
    const code = String(emp.employee_code || emp.id || emp._id || "").toLowerCase();
    const q = searchTerm.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <div className="page ctc-structure-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Employee CTC</h1>
          <p>Staff CTC structure used as base salary for payroll.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/payroll" className="module-hero-btn">
            Back to payroll
          </Link>
        </div>
      </header>

      {error ? <p className="status-error">{error}</p> : null}

      <div className="module-panel user-filter-row">
        <button
          type="button"
          className={`user-filter-btn ${activeTab === "active" ? "active" : ""}`}
          onClick={() => setActiveTab("active")}
        >
          Active employees
        </button>
        <button
          type="button"
          className={`user-filter-btn ${activeTab === "inactive" ? "active" : ""}`}
          onClick={() => setActiveTab("inactive")}
        >
          Inactive employees
        </button>
      </div>

      <div className="module-panel service-filter-bar">
        <label className="service-filter-select">
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name or employee code"
          />
        </label>
      </div>

      <section className="status-card user-table-card">
        {loading ? <p>Loading CTC…</p> : null}

        {!loading && filteredEmployees.length === 0 ? (
          <p className="page-note">No employees found for this filter.</p>
        ) : null}

        {!loading && filteredEmployees.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>EE code</th>
                  <th>Employee</th>
                  <th>Gender</th>
                  <th>Monthly base</th>
                  <th>CTC — annual</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id || emp._id}>
                    <td>{emp.employee_code || "—"}</td>
                    <td>
                      <strong>{getEmpName(emp)}</strong>
                    </td>
                    <td>{getGender(emp)}</td>
                    <td>{formatInr(monthlySalary(emp))}</td>
                    <td>{formatInr(annualCtc(emp))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
