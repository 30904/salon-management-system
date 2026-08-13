import React, { useState, useEffect, useCallback } from "react";
import { fetchShifts, createShift, updateShift, deleteShift } from "../../../api/shiftAndRulesApi.js";
import "./AttendanceSettings.css";

export default function ShiftList() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setShifts(res.data || []);
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

  const summary = {
    total: shifts.length,
    active: shifts.filter((s) => s.is_active).length,
  };

  return (
    <>
      <div className="module-panel service-filter-bar shift-list-toolbar">
        <div>
          <h2 className="shift-list-title">Shift schedules</h2>
          <p className="shift-list-sub">
            Working hours used for staff rosters and late punch checks.
          </p>
        </div>
        <button type="button" className="user-primary-btn user-primary-btn--hero" onClick={handleOpenCreate}>
          + Create New Shift
        </button>
      </div>

      {error ? <p className="status-error">{error}</p> : null}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Shifts</span>
          <strong>{loading ? "…" : summary.total}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Active</span>
          <strong>{loading ? "…" : summary.active}</strong>
        </div>
      </section>

      <section className="status-card user-table-card">
        {loading ? (
          <div className="page-loader" style={{ minHeight: "160px" }}>
            <div className="page-loader-spinner" />
            <span>Loading shift rosters…</span>
          </div>
        ) : null}

        {!loading && shifts.length === 0 ? (
          <div className="shift-empty-state">
            <h3>No shift schedules defined</h3>
            <p>Click “+ Create New Shift” to add Morning, Evening, or Full Day schedules.</p>
          </div>
        ) : null}

        {!loading && shifts.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Shift Schedule Name</th>
                  <th>Start Time (Check-in)</th>
                  <th>End Time (Check-out)</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                        <strong>{shift.name}</strong>
                      </td>
                      <td>
                        <span className="shift-time-badge">{shift.start_time}</span>
                      </td>
                      <td>
                        <span className="shift-time-badge">{shift.end_time}</span>
                      </td>
                      <td>
                        {hours > 0 ? `${hours}h` : ""}
                        {mins > 0 ? `${hours > 0 ? " " : ""}${mins}m` : hours === 0 ? "0m" : ""}
                      </td>
                      <td>
                        <span className={`user-status-pill ${shift.is_active ? "active" : "inactive"}`}>
                          {shift.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="shift-actions-row">
                          <button
                            type="button"
                            className="user-secondary-btn shift-action-btn"
                            onClick={() => handleOpenEdit(shift)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="user-secondary-btn shift-action-btn shift-action-btn--danger"
                            onClick={() => handleDelete(shift.id || shift._id, shift.name)}
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
        ) : null}
      </section>

      {showModal ? (
        <div className="shift-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="shift-form-modal" role="dialog" aria-modal="true">
            <h2 className="shift-modal-title">{selectedShift ? "Edit Shift Schedule" : "Create New Shift Schedule"}</h2>
            <p className="shift-modal-sub">Define start and check-out times for attendance tracking.</p>

            {formError ? <p className="status-error">{formError}</p> : null}

            <form onSubmit={handleFormSubmit} className="shift-form-grid">
              <label className="shift-form-full">
                Shift Schedule Name *
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, Weekend Roster"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </label>

              <label>
                Start Time (24h HH:mm) *
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </label>

              <label>
                End Time (24h HH:mm) *
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </label>

              <label className="shift-form-full shift-form-check">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Active Shift Schedule
              </label>

              <div className="shift-modal-footer">
                <button
                  type="button"
                  className="user-secondary-btn"
                  onClick={() => setShowModal(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="user-primary-btn user-primary-btn--hero" disabled={formLoading}>
                  {formLoading ? "Saving…" : selectedShift ? "Update Shift" : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
