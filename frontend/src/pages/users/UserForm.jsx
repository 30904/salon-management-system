import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  role_id: "",
};

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, hasPermission } = usePermission();

  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [createdInvite, setCreatedInvite] = useState(
    location.state?.invite || null
  );

  const canEdit = hasPermission("users", "edit");
  const canCreate = hasPermission("users", "create");
  const isSelf = isEdit && currentUser?.id === id;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const rolesResponse = await arnavApi.listRoles();

        if (!rolesResponse.success) {
          throw new Error(rolesResponse.message || "Failed to load roles");
        }

        if (cancelled) return;

        setRoles(rolesResponse.data || []);

        if (isEdit) {
          const userResponse = await arnavApi.getUser(id);

          if (!userResponse.success) {
            throw new Error(userResponse.message || "Failed to load user");
          }

          if (cancelled) return;

          const user = userResponse.data;
          setForm({
            name: user.name || "",
            phone: user.phone || "",
            email: user.email || "",
            role_id: String(user.role?.id || user.role_id || ""),
          });
          setIsActive(Boolean(user.is_active));

          if (location.state?.success) {
            setSuccess(location.state.success);
          }
          if (location.state?.invite) {
            setCreatedInvite(location.state.invite);
          }

          if (location.state?.success || location.state?.invite) {
            navigate(location.pathname, { replace: true, state: null });
          }
        } else {
          setForm(EMPTY_FORM);
          setIsActive(true);
          setCreatedInvite(null);
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

    load();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, location.pathname, location.state, navigate]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreatedInvite(null);

    try {
      if (isEdit) {
        if (!canEdit) {
          throw new Error("You do not have permission to edit users");
        }

        const response = await arnavApi.updateUser(id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          role_id: form.role_id,
        });

        if (!response.success) {
          throw new Error(response.message || "Update failed");
        }

        setSuccess("User updated");
        setIsActive(Boolean(response.data.is_active));
      } else {
        if (!canCreate) {
          throw new Error("You do not have permission to create users");
        }

        const response = await arnavApi.createUser({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          role_id: form.role_id,
          send_invite: true,
        });

        if (!response.success) {
          throw new Error(response.message || "Create failed");
        }

        navigate(`/users/${response.data.user.id}/edit`, {
          replace: true,
          state: {
            invite: {
              tempPassword: response.data.tempPassword,
              invite: response.data.invite,
            },
            success: "User created",
          },
        });
        return;
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!isEdit || !canEdit || isSelf) {
      return;
    }

    setStatusUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = isActive
        ? await arnavApi.deactivateUser(id)
        : await arnavApi.activateUser(id);

      if (!response.success) {
        throw new Error(response.message || "Status update failed");
      }

      setIsActive(Boolean(response.data.is_active));
      setSuccess(response.data.is_active ? "User activated" : "User deactivated");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading user form…</p>
      </div>
    );
  }

  return (
    <div className="page user-form-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">User Management</p>
          <h1>{isEdit ? "Edit user" : "Create user"}</h1>
          <p className="page-description">
            {isEdit
              ? "Update profile, role, and activation status."
              : "Create a staff account with role and temporary password invite."}
          </p>
        </div>

        <div className="user-permissions-header-actions">
          <Link to="/users" className="user-secondary-btn">
            Back to users
          </Link>
          {isEdit && canEdit && (
            <Link to={`/users/${id}/permissions`} className="user-secondary-btn">
              Permissions
            </Link>
          )}
        </div>
      </header>

      {error && <p className="status-error">{error}</p>}
      {success && <p className="user-success-text">{success}</p>}

      {createdInvite && (
        <section className="status-card user-invite-card">
          <h2>Invite details</h2>
          <p className="page-note">
            Share this temporary password with the user (also queued via WhatsApp stub).
          </p>
          <p>
            <strong>Temp password:</strong> {createdInvite.tempPassword}
          </p>
          <p>
            <strong>Invite status:</strong>{" "}
            {createdInvite.invite?.status || "skipped"}
          </p>
        </section>
      )}

      <form className="status-card user-form-card" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
            maxLength={120}
          />
        </label>

        <label>
          Phone
          <input
            type="text"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            required
            placeholder="10-digit phone"
          />
        </label>

        <label>
          Email (optional)
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="name@salon.dev"
          />
        </label>

        <label>
          Role
          <select
            value={form.role_id}
            onChange={(e) => updateField("role_id", e.target.value)}
            required
          >
            <option value="" disabled>
              Select role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        {isEdit && (
          <div className="user-status-row">
            <div>
              <p className="user-summary-label">Status</p>
              <span className={`user-status-pill ${isActive ? "active" : "inactive"}`}>
                {isActive ? "Active" : "Inactive"}
              </span>
              {isSelf && (
                <p className="user-meta-text">You cannot deactivate your own account.</p>
              )}
            </div>

            {canEdit && !isSelf && (
              <button
                type="button"
                className={isActive ? "user-danger-btn" : "user-primary-btn"}
                onClick={handleToggleActive}
                disabled={statusUpdating}
              >
                {statusUpdating
                  ? "Updating…"
                  : isActive
                    ? "Deactivate"
                    : "Activate"}
              </button>
            )}
          </div>
        )}

        <div className="user-form-actions">
          <button
            type="submit"
            className="user-primary-btn"
            disabled={saving || (isEdit ? !canEdit : !canCreate)}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}
