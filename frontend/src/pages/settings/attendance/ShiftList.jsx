import React, { useState, useEffect, useCallback } from "react";
import { fetchShifts, createShift, updateShift, deleteShift } from "../../../api/shiftAndRulesApi.js";
import "./AttendanceSettings.css";

export default function ShiftList() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    is_active: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShifts();
      if (res?.success) {
        const list = res.data || [];
        setShifts(list);
      } else {
        setError("Failed to load shift roster.");
      }
    } catch (err) {
      console.error("Error loading shifts:", err);
      setError(err.response?.data?.message || "Unable to connect to Shifts API.");
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const handleOpenCreate = () => {
    setSelectedShift(null);
    setFormData({
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      is_active: true,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (shift) => {
    setSelectedShift(shift);
    setFormData({
      name: shift.name || "",
      start_time: shift.start_time || "09:00",
      end_time: shift.end_time || "18:00",
      is_active: shift.is_active !== undefined ? shift.is_active : true,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleDelete = async (shiftId, shiftName) => {
    if (!window.confirm(`Are you sure you want to delete shift schedule "${shiftName}"?`)) {
      return;
    }
    try {
      await deleteShift(shiftId);
      loadShifts();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete shift.");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      if (selectedShift) {
        await updateShift(selectedShift.id || selectedShift._id, formData);
      } else {
        await createShift(formData);
      }
      setShowModal(false);
      loadShifts();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to save shift schedule.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSimulateDeduction = async (e) => {
    e.preventDefault();
    if (!simShiftId || !simPunchTime) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await evaluateDeduction({
        shift_id: simShiftId,
        punch_time: simPunchTime,
      });
      if (res?.success) {
        setSimResult(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Simulation failed.");
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="shifts-grid-card">
      <div className="section-header-row">
        <div>
          <h2>Shift Schedules Master</h2>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Configure working hours, start and end thresholds for salon staff rosters.
          </p>
        </div>
        <button className="btn-primary-glow" onClick={handleOpenCreate}>
          + Create New Shift
        </button>
      </div>

      {error && <div className="status-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

      {loading ? (
        <div className="page-loader" style={{ minHeight: "180px" }}>
          <div className="page-loader-spinner" />
          <span>Loading Shift Rosters...</span>
        </div>
      ) : shifts.length === 0 ? (
        <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
          <h3>No Shift Schedules Defined</h3>
          <p>Click "+ Create New Shift" to add Morning, Evening, or Full Day schedules.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>Shift Schedule Name</th>
                <th>Start Time (Check-in)</th>
                <th>End Time (Check-out)</th>
                <th>Duration</th>
                <th>Status</th>
                <th style={{ width: "120px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                const [startH, startM] = (shift.start_time || "00:00").split(":").map(Number);
                const [endH, endM] = (shift.end_time || "00:00").split(":").map(Number);
                const totalMins = endH * 60 + endM - (startH * 60 + startM);
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;

                return (
                  <tr key={shift.id || shift._id}>
                    <td>
                      <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>{shift.name}</strong>
                    </td>
                    <td>
                      <span className="shift-time-badge">{shift.start_time}</span>
                    </td>
                    <td>
                      <span className="shift-time-badge">{shift.end_time}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.875rem", color: "#475569", fontWeight: 600 }}>
                        {hours > 0 ? `${hours}h ` : ""}
                        {mins > 0 ? `${mins}m` : hours === 0 ? "0m" : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${shift.is_active ? "ok" : "warn"}`}>
                        {shift.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="actions-row">
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => handleOpenEdit(shift)}
                          title="Edit Shift"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action danger"
                          onClick={() => handleDelete(shift.id || shift._id, shift.name)}
                          title="Delete Shift"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Shift Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="staff-form-modal" style={{ maxWidth: "520px" }}>
            <h2 className="modal-title">{selectedShift ? "Edit Shift Schedule" : "Create New Shift Schedule"}</h2>
            <p className="modal-sub">Define start & check-out times for attendance tracking.</p>

            {formError && <div className="status-error" style={{ marginBottom: "1rem" }}>{formError}</div>}

            <form onSubmit={handleFormSubmit} className="form-grid-2col">
              <div className="form-group full-width">
                <label>Shift Schedule Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Morning Shift, Weekend Roster"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Start Time (24h HH:mm) *</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Time (24h HH:mm) *</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>

              <div className="form-group full-width" style={{ marginTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active Shift Schedule
                </label>
              </div>

              <div className="modal-footer full-width">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={formLoading}>
                  {formLoading ? "Saving..." : selectedShift ? "Update Shift" : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
