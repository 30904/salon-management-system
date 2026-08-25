import React, { useState, useEffect } from "react";
import { createStaffProfile, updateStaffProfile, fetchCommissionSlabs, fetchUsersForStaff } from "../../../api/staffApi.js";
import { fetchShifts } from "../../../api/shiftAndRulesApi.js";
import { usePermission } from "../../../hooks/usePermission.js";
import "./StaffMaster.css";

const PRESET_SPECIALIZATIONS = [
  "Hair Coloring",
  "Haircutting",
  "Keratin Treatment",
  "Hair Spa & Treatment",
  "Facial & Cleanup",
  "Skin Peeling & Bleach",
  "Manicure & Pedicure",
  "Bridal Makeup",
  "Laser Hair Removal",
];

export default function StaffForm({ profile = null, onClose, onSuccess }) {
  const isEdit = Boolean(profile);
  const { hasAnyPermission } = usePermission();
  // Late buffer rides on the same save as other StaffForm fields — no new permission module.
  const canSave = isEdit
    ? hasAnyPermission([
        { module: "settings", action: "edit" },
        { module: "employees", action: "edit" },
      ])
    : hasAnyPermission([
        { module: "settings", action: "create" },
        { module: "employees", action: "create" },
      ]);

  const resolveShiftId = (staffProfile) => {
    if (!staffProfile) return "";
    if (staffProfile.shift?.id) return staffProfile.shift.id;
    if (typeof staffProfile.shift_id === "object" && staffProfile.shift_id) {
      return staffProfile.shift_id.id || staffProfile.shift_id._id || "";
    }
    return staffProfile.shift_id || "";
  };

  const [formData, setFormData] = useState({
    user_id: profile?.user?.id || profile?.user_id || "",
    designation: profile?.designation || "",
    specialization: Array.isArray(profile?.specialization) ? [...profile.specialization] : [],
    commission_slab_id: profile?.commission_slab?.id || profile?.commission_slab_id || "",
    base_salary: profile?.base_salary || 0,
    monthly_target_1: profile?.monthly_target_1 || 0,
    monthly_target_2: profile?.monthly_target_2 || 0,
    weekly_off_day: profile?.weekly_off_day || 1,
    shift_id: resolveShiftId(profile),
    joining_date: profile?.joining_date ? profile.joining_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    late_mark_buffer_minutes:
      profile?.late_mark_buffer_minutes === null ||
      profile?.late_mark_buffer_minutes === undefined
        ? ""
        : String(profile.late_mark_buffer_minutes),
    is_active: profile?.is_active !== undefined ? profile.is_active : true,
  });

  const [tagInput, setTagInput] = useState("");
  const [slabs, setSlabs] = useState([]);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyDefaultTargets = () => {
    const salary = Number(formData.base_salary) || 0;
    setFormData((prev) => ({
      ...prev,
      monthly_target_1: salary * 5,
      monthly_target_2: salary * 7,
    }));
  };

  useEffect(() => {
    async function loadFormMetadata() {
      try {
        const [slabsRes, usersRes, shiftsRes] = await Promise.all([
          fetchCommissionSlabs({ is_active: true }),
          fetchUsersForStaff(),
          fetchShifts({ is_active: true }),
        ]);
        if (slabsRes?.success && Array.isArray(slabsRes.data)) {
          setSlabs(slabsRes.data);
        }
        if (usersRes?.success && Array.isArray(usersRes.data)) {
          setUsers(usersRes.data);
        }
        if (shiftsRes?.success && Array.isArray(shiftsRes.data)) {
          setShifts(shiftsRes.data);
        }
      } catch (err) {
        console.error("Failed loading metadata for staff form:", err);
      }
    }
    loadFormMetadata();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addSpecializationTag = (tagText) => {
    const cleanTag = tagText.trim();
    if (cleanTag && !formData.specialization.includes(cleanTag)) {
      setFormData((prev) => ({
        ...prev,
        specialization: [...prev.specialization, cleanTag],
      }));
    }
    setTagInput("");
  };

  const removeSpecializationTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      specialization: prev.specialization.filter((t) => t !== tagToRemove),
    }));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSpecializationTag(tagInput);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSave) {
      setError("You do not have permission to save staff profiles.");
      return;
    }

    if (!formData.user_id || !formData.designation) {
      setError("Please select a Linked User and specify a Designation.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        base_salary: Number(formData.base_salary) || 0,
        monthly_target_1: Number(formData.monthly_target_1) || 0,
        monthly_target_2: Number(formData.monthly_target_2) || 0,
        weekly_off_day: Number(formData.weekly_off_day) || 1,
        commission_slab_id: formData.commission_slab_id || null,
        shift_id: formData.shift_id || null,
        // Blank = salon default (null). Do not coerce blank to 0.
        late_mark_buffer_minutes:
          formData.late_mark_buffer_minutes === "" ||
          formData.late_mark_buffer_minutes === null ||
          formData.late_mark_buffer_minutes === undefined
            ? null
            : Number(formData.late_mark_buffer_minutes),
      };

      if (isEdit) {
        await updateStaffProfile(profile.id || profile._id, payload);
      } else {
        await createStaffProfile(payload);
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save staff profile.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="staff-form-modal">
        <h2 className="modal-title">{isEdit ? "Edit Staff Master Profile" : "Assign New Staff Profile"}</h2>
        <p className="modal-sub">Configure user link, specializations, salary, sales targets, weekly off, shift, late buffer, and commission slabs.</p>

        {error && <div className="status-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-grid-2col">
          {/* 1. Link to User */}
          <div className="form-group full-width">
            <label htmlFor="user_id">Link to User (System Account) *</label>
            {users.length > 0 ? (
              <select
                id="user_id"
                name="user_id"
                className="form-control"
                value={formData.user_id}
                onChange={handleChange}
                disabled={isEdit} // Cannot reassign user once profile is created
                required
              >
                <option value="">-- Select System User --</option>
                {users.map((u) => (
                  <option key={u.id || u._id} value={u.id || u._id}>
                    {u.name} ({u.phone}) {u.branch_id ? " [Assigned Branch]" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="user_id"
                name="user_id"
                type="text"
                className="form-control"
                placeholder="Enter User ObjectId (24 char hex)"
                value={formData.user_id}
                onChange={handleChange}
                disabled={isEdit}
                required
              />
            )}
            {isEdit && <small style={{ color: "#64748b" }}>User link cannot be changed after profile creation.</small>}
          </div>

          {/* 2. Designation */}
          <div className="form-group">
            <label htmlFor="designation">Designation / Role Title *</label>
            <input
              id="designation"
              name="designation"
              type="text"
              className="form-control"
              placeholder="e.g. Senior Stylist, Colorist"
              value={formData.designation}
              onChange={handleChange}
              required
            />
          </div>

          {/* 3. Base Salary */}
          <div className="form-group">
            <label htmlFor="base_salary">Base Salary (Monthly ₹)</label>
            <input
              id="base_salary"
              name="base_salary"
              type="number"
              min="0"
              className="form-control"
              placeholder="0"
              value={formData.base_salary}
              onChange={handleChange}
            />
          </div>

          {/* 3b. Monthly sales targets */}
          <div className="form-group full-width staff-targets-block">
            <div className="staff-targets-header">
              <label>Monthly Sales Targets (₹)</label>
              <button
                type="button"
                className="btn-link-targets"
                onClick={applyDefaultTargets}
                disabled={!Number(formData.base_salary)}
              >
                Use 5× / 7× salary
              </button>
            </div>
            <div className="staff-targets-grid">
              <div className="form-group">
                <label htmlFor="monthly_target_1">1st Target</label>
                <input
                  id="monthly_target_1"
                  name="monthly_target_1"
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="0"
                  value={formData.monthly_target_1}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="monthly_target_2">2nd Target</label>
                <input
                  id="monthly_target_2"
                  name="monthly_target_2"
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="0"
                  value={formData.monthly_target_2}
                  onChange={handleChange}
                />
              </div>
            </div>
            <small className="staff-targets-hint">
              Shown on the employee mobile app. Leave both at 0 to auto-use 5× / 7× base salary.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="weekly_off_day">Weekly off day *</label>
            <select
              id="weekly_off_day"
              name="weekly_off_day"
              className="form-control"
              value={formData.weekly_off_day}
              onChange={handleChange}
              required
            >
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
            </select>
            <small className="staff-targets-hint">Friday–Sunday are salon blackout days and cannot be a weekly off.</small>
          </div>

          {/* 4. Specialization Multi-Select Box */}
          <div className="form-group full-width">
            <label>Service Specializations (Multi-Select Tag Filter)</label>
            <div className="multi-select-container">
              {formData.specialization.map((tag) => (
                <span key={tag} className="multi-select-pill">
                  {tag}
                  <button type="button" onClick={() => removeSpecializationTag(tag)} aria-label="Remove tag">×</button>
                </span>
              ))}
              <input
                type="text"
                className="tag-add-input"
                placeholder="Type service name & press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
              />
            </div>
            <div className="preset-tags">
              {PRESET_SPECIALIZATIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="preset-tag-btn"
                  onClick={() => addSpecializationTag(preset)}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Commission Slab */}
          <div className="form-group">
            <label htmlFor="commission_slab_id">Assigned Commission Slab</label>
            <select
              id="commission_slab_id"
              name="commission_slab_id"
              className="form-control"
              value={formData.commission_slab_id}
              onChange={handleChange}
            >
              <option value="">-- No Commission Slab --</option>
              {slabs.map((slab) => (
                <option key={slab.id || slab._id} value={slab.id || slab._id}>
                  {slab.name} ({slab.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* 6. Shift */}
          <div className="form-group">
            <label htmlFor="shift_id">Shift</label>
            <select
              id="shift_id"
              name="shift_id"
              className="form-control"
              value={formData.shift_id || ""}
              onChange={handleChange}
            >
              <option value="">No shift assigned</option>
              {shifts.map((shift) => {
                const id = shift.id || shift._id;
                return (
                  <option key={id} value={id}>
                    {shift.name} ({shift.start_time} – {shift.end_time})
                  </option>
                );
              })}
            </select>
            {shifts.length === 0 ? (
              <small className="form-hint">
                No active shifts yet. Create one under Settings → Attendance first.
              </small>
            ) : null}
          </div>

          {/* Late mark buffer — same form-group / form-control as shift & joining date */}
          <div className="form-group">
            <label htmlFor="late_mark_buffer_minutes">Late mark buffer (minutes)</label>
            <input
              id="late_mark_buffer_minutes"
              name="late_mark_buffer_minutes"
              type="number"
              min="0"
              max="30"
              step="1"
              className="form-control"
              placeholder="Default (10 min)"
              value={formData.late_mark_buffer_minutes}
              onChange={handleChange}
            />
            <small className="form-hint">
              Leave blank to use salon default. 0 means any lateness after shift start is late.
            </small>
          </div>

          {/* 7. Joining Date */}
          <div className="form-group">
            <label htmlFor="joining_date">Joining Date</label>
            <input
              id="joining_date"
              name="joining_date"
              type="date"
              className="form-control"
              value={formData.joining_date}
              onChange={handleChange}
            />
          </div>

          {/* 8. Active Status Toggle */}
          <div className="form-group" style={{ justifyContent: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              Active Staff Profile
            </label>
          </div>

          <div className="modal-footer full-width">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading || !canSave}>
              {loading ? "Saving..." : isEdit ? "Update Staff Profile" : "Create Staff Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
