import React, { useState, useEffect, useCallback } from "react";
import { fetchPackageMasters, deletePackageMaster } from "../../../api/packageMasterApi.js";
import PackageMasterForm from "./PackageMasterForm.jsx";
import "../attendance/AttendanceSettings.css";

export default function PackageMasterList() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'prepaid_bundle' | 'membership'
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (activeFilter !== "all") {
        params.type = activeFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const res = await fetchPackageMasters(params);
      if (res?.success) {
        setPackages(res.data || []);
      } else {
        setError("Failed to load package definitions.");
      }
    } catch (err) {
      console.error("Error loading packages:", err);
      setError(err.response?.data?.message || "Unable to connect to Package Master API.");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleOpenCreate = () => {
    setSelectedPackage(null);
    setShowModal(true);
  };

  const handleOpenEdit = (pkg) => {
    setSelectedPackage(pkg);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate package definition "${name}"?`)) {
      return;
    }
    try {
      await deletePackageMaster(id);
      loadPackages();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to deactivate package.");
    }
  };

  return (
    <div className="attendance-settings-container">
      {/* Header Banner */}
      <div className="attendance-header-banner">
        <div className="attendance-banner-text">
          <h1>Package & VIP Membership Masters</h1>
          <p>
            Configure prepaid multi-sitting bundles, sitting credit counts, and recurring VIP membership discount tiers.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", margin: "1.5rem 0" }}>
        <div className="attendance-tabs" style={{ margin: 0, borderBottom: "none" }}>
          <button
            type="button"
            className={`attendance-tab-btn ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All Definitions
          </button>
          <button
            type="button"
            className={`attendance-tab-btn ${activeFilter === "prepaid_bundle" ? "active" : ""}`}
            onClick={() => setActiveFilter("prepaid_bundle")}
          >
            Prepaid Multi-Sitting Bundles
          </button>
          <button
            type="button"
            className={`attendance-tab-btn ${activeFilter === "membership" ? "active" : ""}`}
            onClick={() => setActiveFilter("membership")}
          >
            VIP Memberships
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search package by name..."
            style={{ padding: "0.55rem 0.85rem", minWidth: "220px", borderRadius: "10px" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn-primary-glow" onClick={handleOpenCreate}>
            + Create New Package Master
          </button>
        </div>
      </div>

      {error && <div className="status-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

      <div className="shifts-grid-card">
        {loading ? (
          <div className="page-loader" style={{ minHeight: "220px" }}>
            <div className="page-loader-spinner" />
            <span>Loading Package & Membership Definitions...</span>
          </div>
        ) : packages.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <h3>No Package Definitions Found</h3>
            <p>Click "+ Create New Package Master" to define prepaid salon bundles or VIP membership tiers.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Package / Membership Title</th>
                  <th>Type</th>
                  <th>Selling Price</th>
                  <th>Validity</th>
                  <th>Credit / Discount Logic Summary</th>
                  <th>Status</th>
                  <th style={{ width: "110px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id || pkg._id}>
                    <td>
                      <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>{pkg.name}</strong>
                    </td>
                    <td>
                      <span
                        className="shift-time-badge"
                        style={{
                          background: pkg.type === "prepaid_bundle" ? "#e0e7ff" : "#fef3c7",
                          color: pkg.type === "prepaid_bundle" ? "#3730a3" : "#92400e",
                        }}
                      >
                        {pkg.type === "prepaid_bundle" ? "Prepaid Bundle" : "VIP Membership"}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                        ₹{Number(pkg.price || 0).toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.875rem", color: "#475569", fontWeight: 600 }}>
                        {pkg.validity_days} Days
                      </span>
                    </td>
                    <td>
                      {pkg.type === "prepaid_bundle" ? (
                        <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                          <strong>{pkg.credit_count || 0} Total Credits</strong>
                          {Array.isArray(pkg.included_services) && pkg.included_services.length > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                              {pkg.included_services.map((s, i) => `${s.service_name} (${s.sittings_allowed}x)`).join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                          <strong>Services: {pkg.discount_logic_json?.services_discount_pct || 0}% off</strong> |{" "}
                          <span>Products: {pkg.discount_logic_json?.products_discount_pct || 0}% off</span>
                          {pkg.discount_logic_json?.tier_note && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                              {pkg.discount_logic_json.tier_note}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${pkg.is_active ? "ok" : "warn"}`}>
                        {pkg.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="actions-row">
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => handleOpenEdit(pkg)}
                          title="Edit Package Definition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action danger"
                          onClick={() => handleDelete(pkg.id || pkg._id, pkg.name)}
                          title="Deactivate Package"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <PackageMasterForm
          selectedPackage={selectedPackage}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadPackages();
          }}
        />
      )}
    </div>
  );
}
