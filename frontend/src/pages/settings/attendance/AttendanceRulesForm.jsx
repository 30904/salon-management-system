import React, { useState, useEffect, useCallback } from "react";
import { fetchAttendanceRules, createAttendanceRule, updateAttendanceRule } from "../../../api/shiftAndRulesApi.js";
import "./AttendanceSettings.css";

const DEFAULT_LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", annual_quota: 12, paid: true },
  { code: "SL", name: "Sick Leave", annual_quota: 6, paid: true },
  { code: "EL", name: "Earned / Annual Leave", annual_quota: 15, paid: true },
  { code: "LOP", name: "Loss of Pay (Unpaid)", annual_quota: 0, paid: false },
];

export default function AttendanceRulesForm() {
  const [ruleId, setRuleId] = useState(null);
  const [name, setName] = useState("Salon Default Attendance Rules");
  const [lateMarkMinutes, setLateMarkMinutes] = useState(15);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  const loadRule = useCallback(async () => {
    setLoading(true);
    setStatusMsg({ type: "", text: "" });
    try {
      const res = await fetchAttendanceRules();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        const first = res.data[0];
        setRuleId(first.id || first._id);
        setName(first.name || "Salon Default Attendance Rules");
        setLateMarkMinutes(first.late_mark_minutes !== undefined ? first.late_mark_minutes : 15);
        if (Array.isArray(first.leave_types) && first.leave_types.length > 0) {
          setLeaveTypes(first.leave_types);
        }
        setIsActive(first.is_active !== undefined ? first.is_active : true);
      }
    } catch (err) {
      console.error("Error loading attendance rule:", err);
      setStatusMsg({ type: "error", text: "Unable to load existing attendance rules. Creating new configuration." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRule();
  }, [loadRule]);

  const handleLeaveChange = (index, field, value) => {
    setLeaveTypes((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddLeaveRow = () => {
    setLeaveTypes((prev) => [
      ...prev,
      { code: `LT_${prev.length + 1}`, name: "New Leave Category", annual_quota: 5, paid: true },
    ]);
  };

  const handleRemoveLeaveRow = (index) => {
    if (leaveTypes.length <= 1) {
      alert("At least one leave category must be defined.");
      return;
    }
    setLeaveTypes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg({ type: "", text: "" });
    try {
      const payload = {
        name: name.trim() || "Salon Default Attendance Rules",
        late_mark_minutes: Number(lateMarkMinutes) || 0,
        leave_types: leaveTypes.map((lt) => ({
          code: lt.code.trim().toUpperCase(),
          name: lt.name.trim(),
          annual_quota: lt.annual_quota !== null && lt.annual_quota !== "" ? Number(lt.annual_quota) : null,
          paid: Boolean(lt.paid),
        })),
        is_active: isActive,
      };

      if (ruleId) {
        const res = await updateAttendanceRule(ruleId, payload);
        if (res?.success) {
          setStatusMsg({ type: "success", text: "Attendance rules & leave quotas updated successfully! ⚡" });
        }
      } else {
        const res = await createAttendanceRule(payload);
        if (res?.success && res.data) {
          setRuleId(res.data.id || res.data._id);
          setStatusMsg({ type: "success", text: "New attendance rules & leave quotas created successfully! ⚡" });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save attendance rules.";
      setStatusMsg({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rules-config-card">
        <div className="page-loader" style={{ minHeight: "180px" }}>
          <div className="page-loader-spinner" />
          <span>Loading Attendance & Leave Rules Configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rules-config-card">
      <div className="section-header-row">
        <div>
          <h2>Attendance Threshold & Leave Quota Rules</h2>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            These parameters govern grace limits, late penalty marks, and annual leave allowances across the salon.
          </p>
        </div>
      </div>

      {statusMsg.text && (
        <div
          className={statusMsg.type === "error" ? "status-error" : "status-success"}
          style={{ marginBottom: "1.5rem" }}
        >
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSaveRule}>
        <div className="form-grid-2col" style={{ marginBottom: "1.75rem" }}>
          <div className="form-group">
            <label htmlFor="rule_name">Attendance Rule Policy Name *</label>
            <input
              id="rule_name"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="late_mark_minutes">Late Mark Grace Threshold (Minutes) *</label>
            <input
              id="late_mark_minutes"
              type="number"
              min="0"
              className="form-control"
              value={lateMarkMinutes}
              onChange={(e) => setLateMarkMinutes(e.target.value)}
              required
            />
            <small style={{ color: "#64748b" }}>
              Punches recorded beyond this limit after shift start will trigger late mark deduction logic.
            </small>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem" }}>
          <div className="section-header-row" style={{ marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", margin: 0, color: "#0f172a" }}>Leave Categories & Annual Quotas (JSON)</h3>
              <p style={{ color: "#64748b", fontSize: "0.825rem", margin: 0 }}>
                Define all paid and unpaid leave categories available to staff members.
              </p>
            </div>
            <button type="button" className="btn-add-leave" onClick={handleAddLeaveRow}>
              + Add Leave Category
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="leave-quota-table">
              <thead>
                <tr>
                  <th style={{ width: "130px" }}>Leave Code</th>
                  <th>Leave Category Title</th>
                  <th style={{ width: "160px" }}>Annual Quota (Days)</th>
                  <th style={{ width: "130px" }}>Paid Leave?</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((leave, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={leave.code || ""}
                        placeholder="e.g. CL"
                        onChange={(e) => handleLeaveChange(idx, "code", e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={leave.name || ""}
                        placeholder="e.g. Casual Leave"
                        onChange={(e) => handleLeaveChange(idx, "name", e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={leave.annual_quota !== null && leave.annual_quota !== undefined ? leave.annual_quota : ""}
                        placeholder="0 (Unlimited/Unpaid)"
                        onChange={(e) => handleLeaveChange(idx, "annual_quota", e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(leave.paid)}
                          onChange={(e) => handleLeaveChange(idx, "paid", e.target.checked)}
                        />
                      </label>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn-icon-action danger"
                        onClick={() => handleRemoveLeaveRow(idx)}
                        title="Delete Leave Category"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer full-width" style={{ marginTop: "2rem" }}>
          <button type="submit" className="btn-submit" disabled={saving}>
            {saving ? "Saving Policy..." : ruleId ? "Save & Update Attendance Rules" : "Create Attendance Rules"}
          </button>
        </div>
      </form>
    </div>
  );
}
