import React, { useState, useEffect, useCallback } from "react";
import { fetchStaffProfiles, deleteStaffProfile } from "../../../api/staffApi.js";
import StaffForm from "./StaffForm.jsx";
import "./StaffMaster.css";

export default function StaffList() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [specializationFilter, setSpecializationFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (specializationFilter.trim()) {
        params.specialization = specializationFilter.trim();
      }
      if (designationFilter.trim()) {
        params.designation = designationFilter.trim();
      }

      const res = await fetchStaffProfiles(params);
      if (res?.success) {
        setProfiles(res.data || []);
      } else {
        setError("Failed loading staff profiles.");
      }
    } catch (err) {
      console.error("Error loading staff list:", err);
      setError(err.response?.data?.message || "Unable to connect to Staff Master API.");
    } finally {
      setLoading(false);
    }
  }, [specializationFilter, designationFilter]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleOpenCreate = () => {
    setSelectedProfile(null);
    setShowModal(true);
  };

  const handleOpenEdit = (profile) => {
    setSelectedProfile(profile);
    setShowModal(true);
  };

  const handleDelete = async (profileId, stylistName) => {
    if (!window.confirm(`Are you sure you want to deactivate staff profile for "${stylistName}"?`)) {
      return;
    }
    try {
      await deleteStaffProfile(profileId);
      loadProfiles();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to deactivate staff profile.");
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setSelectedProfile(null);
    loadProfiles();
  };

  return (
    <div className="page staff-master-container">
      {/* Header Banner */}
      <div className="staff-header-banner">
        <div className="staff-banner-text">
          <h1>Staff Master & Specialization Roster</h1>
          <p>Manage stylist profiles, link system user credentials, assign commission slabs & schedules.</p>
        </div>
        <button className="btn-primary-glow" onClick={handleOpenCreate}>
          + Assign New Staff Profile
        </button>
      </div>

      {/* Filter Bar */}
      <div className="staff-filter-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Filter by specialization (e.g. Hair Coloring, Facial)..."
          value={specializationFilter}
          onChange={(e) => setSpecializationFilter(e.target.value)}
        />
        <input
          type="text"
          className="filter-input"
          placeholder="Filter by designation (e.g. Senior Stylist)..."
          value={designationFilter}
          onChange={(e) => setDesignationFilter(e.target.value)}
        />
        {(specializationFilter || designationFilter) && (
          <button
            type="button"
            className="btn-icon-action"
            onClick={() => {
              setSpecializationFilter("");
              setDesignationFilter("");
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && <div className="status-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* Staff Grid Table */}
      <div className="staff-grid-table-card">
        {loading ? (
          <div className="page-loader" style={{ minHeight: "240px" }}>
            <div className="page-loader-spinner" />
            <span>Loading Stylist Roster...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="staff-empty-state">
            <h3>No Staff Profiles Found</h3>
            <p>Assign a staff profile to an existing user to get started.</p>
          </div>
        ) : (
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Linked User Account</th>
                  <th>Designation</th>
                  <th>Specializations</th>
                  <th>Base Salary</th>
                  <th>Shift / Schedule</th>
                  <th>Commission Slab</th>
                  <th>Status</th>
                  <th style={{ width: "130px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const userObj = profile.user || {};
                  const slabObj = profile.commission_slab || {};
                  const stylistName = userObj.name || "Unknown User";

                  return (
                    <tr key={profile.id || profile._id}>
                      {/* Linked User Account */}
                      <td>
                        <div className="stylist-user-link">
                          <span className="stylist-name">{stylistName}</span>
                          <span className="stylist-sub">{userObj.phone || "No Phone"} • {userObj.email || "No Email"}</span>
                        </div>
                      </td>

                      {/* Designation */}
                      <td>
                        <strong className="stylist-name">{profile.designation}</strong>
                      </td>

                      {/* Specialization Tags */}
                      <td>
                        <div className="specialization-tags">
                          {Array.isArray(profile.specialization) && profile.specialization.length > 0 ? (
                            profile.specialization.map((spec, idx) => (
                              <span key={idx} className="spec-badge">
                                {spec}
                              </span>
                            ))
                          ) : (
                            <span className="staff-meta-muted">General</span>
                          )}
                        </div>
                      </td>

                      {/* Base Salary */}
                      <td>
                        <span className="salary-badge">
                          ₹{(profile.base_salary || 0).toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Shift / Schedule */}
                      <td>
                        <span className="staff-meta-muted">
                          {profile.shift_id ? String(profile.shift_id) : "General Shift"}
                        </span>
                      </td>

                      {/* Commission Slab */}
                      <td>
                        {slabObj && slabObj.name ? (
                          <span className="commission-pill" title={`Rules: ${JSON.stringify(slabObj.rules_json)}`}>
                            {slabObj.name} ({slabObj.type})
                          </span>
                        ) : (
                          <span className="staff-meta-muted">None Assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill ${profile.is_active ? "ok" : "warn"}`}>
                          {profile.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="actions-row">
                          <button
                            type="button"
                            className="btn-icon-action"
                            onClick={() => handleOpenEdit(profile)}
                            title="Edit Staff Profile"
                          >
                            Edit
                          </button>
                          {profile.is_active && (
                            <button
                              type="button"
                              className="btn-icon-action danger"
                              onClick={() => handleDelete(profile.id || profile._id, stylistName)}
                              title="Deactivate Staff Profile"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Form Modal */}
      {showModal && (
        <StaffForm
          profile={selectedProfile}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
