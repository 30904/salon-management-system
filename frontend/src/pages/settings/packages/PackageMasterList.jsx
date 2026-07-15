import React, { useState, useEffect, useCallback } from "react";
import { fetchPackageMasters, deletePackageMaster } from "../../../api/packageMasterApi.js";
import PackageMasterForm from "./PackageMasterForm.jsx";

function formatInr(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

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

  // KPI calculations across current list
  const summary = {
    total: packages.length,
    prepaidCount: packages.filter((p) => p.type === "prepaid_bundle").length,
    membershipCount: packages.filter((p) => p.type === "membership").length,
    activeCount: packages.filter((p) => p.is_active !== false).length,
  };

  return (
    <div className="page-wrap" style={{ maxWidth: "1250px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Top Hero Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #0f3d3e 0%, #1a8a82 100%)",
          borderRadius: "18px",
          padding: "1.75rem 2rem",
          color: "#ffffff",
          boxShadow: "0 18px 40px rgba(15, 61, 62, 0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <p className="dashboard-hero__eyebrow" style={{ color: "rgba(248, 250, 252, 0.72)", margin: "0 0 0.25rem" }}>
            Settings & Catalog Management
          </p>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.85rem", fontWeight: 700 }}>
            Package & Membership Masters
          </h1>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "rgba(248, 250, 252, 0.85)", maxWidth: "640px" }}>
            Configure prepaid multi-sitting service bundles, sitting credit allocations, and recurring VIP membership discount tiers for your salon branches.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadPackages}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              padding: "0.6rem 1.15rem",
              borderRadius: "999px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="user-primary-btn"
            style={{
              background: "#ffffff",
              color: "#0f3d3e",
              padding: "0.65rem 1.35rem",
              borderRadius: "999px",
              fontSize: "0.9rem",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
            }}
          >
            + Create New Package Master
          </button>
        </div>
      </section>

      {/* KPI Cards Row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
        <div
          className="status-card"
          style={{
            background: "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Prepaid Bundles</span>
            <span style={{ fontSize: "0.75rem", background: "#eff6ff", color: "#2563eb", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Multi-Sitting</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{summary.prepaidCount}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Prepaid credit bundles</span>
        </div>

        <div
          className="status-card"
          style={{
            background: "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>VIP Memberships</span>
            <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Tiers</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{summary.membershipCount}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Recurring discount plans</span>
        </div>

        <div
          className="status-card"
          style={{
            background: "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Active Definitions</span>
            <span style={{ fontSize: "0.75rem", background: "#d1fae5", color: "#065f46", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Live in POS</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1a8a82" }}>{summary.activeCount}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Available for customer assignment</span>
        </div>

        <div
          className="status-card"
          style={{
            background: "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Catalog</span>
            <span style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>All</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{summary.total}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Configured package masters</span>
        </div>
      </section>

      {/* Main Table Card */}
      <section
        className="status-card user-table-card"
        style={{
          background: "var(--s21-surface, #ffffff)",
          borderRadius: "18px",
          border: "1px solid #e8edf3",
          boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
          padding: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          {/* Filters */}
          <div className="user-filter-row" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`user-filter-btn ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              All Definitions ({summary.total})
            </button>
            <button
              type="button"
              className={`user-filter-btn ${activeFilter === "prepaid_bundle" ? "active" : ""}`}
              onClick={() => setActiveFilter("prepaid_bundle")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              Prepaid Bundles ({summary.prepaidCount})
            </button>
            <button
              type="button"
              className={`user-filter-btn ${activeFilter === "membership" ? "active" : ""}`}
              onClick={() => setActiveFilter("membership")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              VIP Memberships ({summary.membershipCount})
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search package title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
              width: "260px",
            }}
          />
        </div>

        {error && <div className="status-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

        {loading ? (
          <p style={{ color: "#64748b", fontStyle: "italic", padding: "2.5rem 0", textAlign: "center" }}>
            Loading package masters...
          </p>
        ) : packages.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
            <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "1.05rem" }}>No package definitions found</p>
            <button type="button" onClick={handleOpenCreate} className="user-primary-btn">
              + Create First Package Master
            </button>
          </div>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Package / Membership Title</th>
                  <th>Type</th>
                  <th>Selling Price</th>
                  <th>Validity</th>
                  <th>Credit & Discount Structure</th>
                  <th>Status</th>
                  <th style={{ width: "130px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id || pkg._id}>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{pkg.name}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: pkg.type === "prepaid_bundle" ? "#eff6ff" : "#fef3c7",
                          color: pkg.type === "prepaid_bundle" ? "#2563eb" : "#92400e",
                        }}
                      >
                        {pkg.type === "prepaid_bundle" ? "Prepaid Bundle" : "VIP Membership"}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "#1a8a82", fontSize: "1rem" }}>
                        {formatInr(pkg.price || 0)}
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
                          <strong style={{ color: "#0f172a" }}>{pkg.credit_count || 0} Total Credits</strong>
                          {Array.isArray(pkg.included_services) && pkg.included_services.length > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                              {pkg.included_services.map((s) => `${s.service_name} (${s.sittings_allowed}x)`).join(", ")}
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
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: pkg.is_active ? "#d1fae5" : "#fee2e2",
                          color: pkg.is_active ? "#065f46" : "#991b1b",
                        }}
                      >
                        {pkg.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="user-secondary-btn"
                          onClick={() => handleOpenEdit(pkg)}
                          style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(pkg.id || pkg._id, pkg.name)}
                          style={{
                            padding: "0.35rem 0.7rem",
                            fontSize: "0.8rem",
                            borderRadius: "8px",
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
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
      </section>

      {/* Modal for Create/Edit */}
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
