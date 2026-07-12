import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import { hasPermission } from "../../utils/permissions.js";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  formatModuleLabel,
  permissionKey,
} from "../../utils/permissionCatalog.js";

function buildOverrideMap(overrides = []) {
  const map = new Map();

  for (const override of overrides) {
    const module = override.permission?.module;
    const action = override.permission?.action;

    if (module && action) {
      map.set(permissionKey(module, action), Boolean(override.granted));
    }
  }

  return map;
}

function getCellState(module, action, rolePermissions, overrideMap) {
  const key = permissionKey(module, action);

  if (overrideMap.has(key)) {
    return overrideMap.get(key) ? "grant" : "revoke";
  }

  return hasPermission(rolePermissions, module, action) ? "inherit-on" : "inherit-off";
}

function cycleCellState(currentState, roleHasPermission) {
  if (currentState === "inherit-on") {
    return "revoke";
  }

  if (currentState === "inherit-off") {
    return "grant";
  }

  return roleHasPermission ? "inherit-on" : "inherit-off";
}

function buildInitialGrid(rolePermissions, overrides) {
  const overrideMap = buildOverrideMap(overrides);
  const grid = {};

  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      grid[permissionKey(module, action)] = getCellState(
        module,
        action,
        rolePermissions,
        overrideMap
      );
    }
  }

  return grid;
}

function buildOverridesPayload(grid, rolePermissions) {
  const overrides = [];

  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      const key = permissionKey(module, action);
      const state = grid[key];
      const roleHas = hasPermission(rolePermissions, module, action);

      if (state === "grant" && !roleHas) {
        overrides.push({ module, action, granted: true });
      } else if (state === "revoke" && roleHas) {
        overrides.push({ module, action, granted: false });
      }
    }
  }

  return overrides;
}

const CELL_LABELS = {
  "inherit-on": "Role",
  "inherit-off": "—",
  grant: "Granted",
  revoke: "Revoked",
};

export default function UserPermissionOverrides() {
  const { id } = useParams();
  const { hasPermission: can } = usePermission();

  const [user, setUser] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [grid, setGrid] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [moduleFilter, setModuleFilter] = useState("all");

  const canEdit = can("users", "edit");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [userResponse, overridesResponse] = await Promise.all([
          arnavApi.getUser(id),
          arnavApi.getUserPermissionOverrides(id),
        ]);

        if (!userResponse.success) {
          throw new Error(userResponse.message || "Failed to load user");
        }

        if (!overridesResponse.success) {
          throw new Error(
            overridesResponse.message || "Failed to load permission overrides"
          );
        }

        if (cancelled) return;

        const rolePerms = overridesResponse.data.role_permissions || [];
        const overrides = overridesResponse.data.overrides || [];

        setUser(userResponse.data);
        setRolePermissions(rolePerms);
        setGrid(buildInitialGrid(rolePerms, overrides));
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

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const visibleModules = useMemo(() => {
    if (moduleFilter === "all") {
      return PERMISSION_MODULES;
    }

    return PERMISSION_MODULES.filter((module) => module === moduleFilter);
  }, [moduleFilter]);

  const overrideCount = useMemo(() => {
    return Object.values(grid).filter(
      (state) => state === "grant" || state === "revoke"
    ).length;
  }, [grid]);

  function handleCellClick(module, action) {
    if (!canEdit) {
      return;
    }

    const key = permissionKey(module, action);
    const roleHas = hasPermission(rolePermissions, module, action);

    setGrid((prev) => ({
      ...prev,
      [key]: cycleCellState(prev[key], roleHas),
    }));
    setSuccess(null);
  }

  async function handleSave() {
    if (!canEdit) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const overrides = buildOverridesPayload(grid, rolePermissions);
      const response = await arnavApi.updateUserPermissionOverrides(id, overrides);

      if (!response.success) {
        throw new Error(response.message || "Failed to save overrides");
      }

      const rolePerms = response.data.role_permissions || rolePermissions;
      const savedOverrides = response.data.overrides || [];

      setRolePermissions(rolePerms);
      setGrid(buildInitialGrid(rolePerms, savedOverrides));
      setSuccess("Permission overrides saved");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!canEdit) {
      return;
    }

    setGrid(buildInitialGrid(rolePermissions, []));
    setSuccess(null);
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading permission overrides…</p>
      </div>
    );
  }

  return (
    <div className="page user-permissions-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">User Management</p>
          <h1>Permission overrides</h1>
          <p className="page-description">
            Toggle per-user access on top of the role baseline for{" "}
            <strong>{user?.name || "this user"}</strong>
            {user?.role?.name ? ` (${user.role.name})` : ""}.
          </p>
        </div>

        <div className="user-permissions-header-actions">
          <Link to={`/users/${id}/edit`} className="user-secondary-btn">
            Edit user
          </Link>
          <Link to="/users" className="user-secondary-btn">
            Back to users
          </Link>
        </div>
      </header>

      {error && <p className="status-error">{error}</p>}
      {success && <p className="user-success-text">{success}</p>}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Modules</span>
          <strong>{PERMISSION_MODULES.length}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Overrides</span>
          <strong>{overrideCount}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Actions</span>
          <strong>{PERMISSION_ACTIONS.length}</strong>
        </div>
      </section>

      <div className="user-permissions-toolbar">
        <label className="user-permissions-filter">
          Module
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
          >
            <option value="all">All modules</option>
            {PERMISSION_MODULES.map((module) => (
              <option key={module} value={module}>
                {formatModuleLabel(module)}
              </option>
            ))}
          </select>
        </label>

        <div className="user-permissions-legend">
          <span className="perm-legend-item inherit-on">Role default</span>
          <span className="perm-legend-item grant">Granted override</span>
          <span className="perm-legend-item revoke">Revoked override</span>
          <span className="perm-legend-item inherit-off">No access</span>
        </div>
      </div>

      <section className="status-card user-permissions-card">
        <div className="user-permissions-grid-wrap">
          <table className="user-permissions-grid">
            <thead>
              <tr>
                <th>Module</th>
                {PERMISSION_ACTIONS.map((action) => (
                  <th key={action}>{action}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleModules.map((module) => (
                <tr key={module}>
                  <th scope="row">{formatModuleLabel(module)}</th>
                  {PERMISSION_ACTIONS.map((action) => {
                    const key = permissionKey(module, action);
                    const state = grid[key] || "inherit-off";

                    return (
                      <td key={key}>
                        <button
                          type="button"
                          className={`perm-toggle ${state}`}
                          onClick={() => handleCellClick(module, action)}
                          disabled={!canEdit}
                          title={
                            canEdit
                              ? "Click to cycle override"
                              : "You cannot edit permissions"
                          }
                        >
                          {CELL_LABELS[state]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && (
        <div className="user-permissions-actions">
          <button
            type="button"
            className="user-secondary-btn"
            onClick={handleReset}
            disabled={saving}
          >
            Clear unsaved changes
          </button>
          <button
            type="button"
            className="user-primary-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save overrides"}
          </button>
        </div>
      )}
    </div>
  );
}
