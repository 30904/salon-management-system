import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

function StatusBadge({ isActive }) {
  return (
    <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function UserList() {
  const { hasPermission } = usePermission();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const canCreate = hasPermission("users", "create");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError(null);

      try {
        const params =
          statusFilter === "all"
            ? {}
            : { is_active: statusFilter === "active" ? "true" : "false" };

        const response = await arnavApi.listUsers(params);

        if (!cancelled) {
          if (response.success) {
            setUsers(response.data || []);
          } else {
            setError(response.message || "Failed to load users");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const summary = useMemo(() => {
    const activeCount = users.filter((user) => user.is_active).length;
    return {
      total: users.length,
      active: activeCount,
      inactive: users.length - activeCount,
    };
  }, [users]);

  return (
    <div className="page user-list-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">User Management</p>
          <h1>Users</h1>
          <p className="page-description">
            Owner/CEO view of salon staff accounts, roles, and access status.
          </p>
        </div>

        {canCreate && (
          <Link to="/users/new" className="user-primary-btn">
            Add user
          </Link>
        )}
      </header>

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Shown</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Inactive</span>
          <strong>{summary.inactive}</strong>
        </div>
      </section>

      <div className="user-filter-row">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`user-filter-btn ${
              statusFilter === filter.key ? "active" : ""
            }`}
            onClick={() => setStatusFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section className="status-card user-table-card">
        {loading && <p>Loading users…</p>}
        {error && <p className="status-error">{error}</p>}

        {!loading && !error && users.length === 0 && (
          <p className="page-note">No users found for this filter.</p>
        )}

        {!loading && !error && users.length > 0 && (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Branch</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        <strong>{user.name}</strong>
                        {user.email && (
                          <span className="user-meta-text">{user.email}</span>
                        )}
                      </div>
                    </td>
                    <td>{user.phone}</td>
                    <td>{user.role?.name || "—"}</td>
                    <td>
                      <StatusBadge isActive={user.is_active} />
                    </td>
                    <td>{user.branch?.name || user.branch?.code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
