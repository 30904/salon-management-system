import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const canCreate = hasPermission("users", "create");
  const canEdit = hasPermission("users", "edit");
  const canDelete = hasPermission("users", "delete");

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        statusFilter === "all"
          ? {}
          : { is_active: statusFilter === "active" ? "true" : "false" };

      const response = await arnavApi.listUsers(params);
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setError(response.message || "Failed to load users");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const handleStatusToggle = async (user) => {
    try {
      const res = user.is_active
        ? await arnavApi.deactivateUser(user.id)
        : await arnavApi.activateUser(user.id);

      if (!res?.success) throw new Error(res?.message || "Failed to update status");
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Status update failed");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to deactivate/delete user account "${user.name}"?`)) return;
    try {
      const res = await arnavApi.deactivateUser(user.id);
      if (!res?.success) throw new Error(res?.message || "Failed to delete user");
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Delete failed");
    }
  };

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
          <div className="user-table-wrap" style={{ paddingBottom: openActionMenuId ? "180px" : "0", transition: "padding-bottom 0.2s ease" }}>
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Branch</th>
                  <th>Actions</th>
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
                    <td>
                      <div className="inventory-actions-dropdown-wrap" style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="inventory-action-dots-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId((prev) => (prev === user.id ? null : user.id));
                          }}
                          title="Actions Menu"
                        >
                          ⋮
                        </button>

                        {openActionMenuId === user.id && (
                          <div className="inventory-actions-popup" onClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate(`/users/${user.id}/edit`);
                                  }}
                                >
                                  Edit Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    navigate(`/users/${user.id}/permissions`);
                                  }}
                                >
                                  Permissions
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleStatusToggle(user);
                                  }}
                                >
                                  {user.is_active ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                            {(canEdit || canDelete) && (
                              <button
                                type="button"
                                className="delete-action"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDeleteUser(user);
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
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
