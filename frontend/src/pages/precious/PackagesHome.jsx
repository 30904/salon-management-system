import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { preciousApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

function formatInr(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PackagesHome() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("billing", "create");

  const [customerPackages, setCustomerPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await preciousApi.listCustomerPackages();
      const list = res?.data || (Array.isArray(res) ? res : []);
      setCustomerPackages(list);
    } catch (err) {
      console.error("Failed to load customer packages:", err);
      setError("Unable to load customer packages. Please check connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered packages
  const filteredList = useMemo(() => {
    return customerPackages.filter((doc) => {
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = (doc.customer?.name || doc.customer_id?.name || "").toLowerCase();
        const custPhone = String(doc.customer?.phone || doc.customer_id?.phone || "");
        const pkgName = (doc.package_master?.name || doc.package_master_id?.name || "").toLowerCase();
        const invId = (doc.invoice_id || "").toLowerCase();
        return custName.includes(q) || custPhone.includes(q) || pkgName.includes(q) || invId.includes(q);
      }
      return true;
    });
  }, [customerPackages, statusFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    let activeCount = 0;
    let totalCredits = 0;
    customerPackages.forEach((doc) => {
      if (doc.status === "active") {
        activeCount++;
        totalCredits += Number(doc.credits_remaining || 0);
      }
    });
    return {
      totalSold: customerPackages.length,
      activeCount,
      totalCredits,
    };
  }, [customerPackages]);

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
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <p className="dashboard-hero__eyebrow" style={{ color: "rgba(248, 250, 252, 0.72)", margin: "0 0 0.25rem" }}>
            Customer Bundles & Subscriptions
          </p>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.85rem", fontWeight: 700 }}>Package Sale & Redemption</h1>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "rgba(248, 250, 252, 0.85)", maxWidth: "620px" }}>
            Manage active prepaid service packages and membership balances. Assign new packages to clients or check credit expiration dates.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <Link
            to="/packages/list"
            style={{
              background: "rgba(255, 255, 255, 0.18)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              padding: "0.6rem 1.15rem",
              borderRadius: "999px",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            👥 Per-Customer Portfolio
          </Link>
          <button
            type="button"
            onClick={loadData}
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
          {canCreate && (
            <Link
              to="/packages/sale"
              className="user-primary-btn"
              style={{
                background: "#ffffff",
                color: "#0f3d3e",
                padding: "0.65rem 1.35rem",
                borderRadius: "999px",
                fontSize: "0.9rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
              }}
            >
              + New Package Sale
            </Link>
          )}
        </div>
      </section>

      {/* KPI Summary Row */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Active Packages</span>
            <span style={{ fontSize: "0.75rem", background: "#d1fae5", color: "#065f46", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{summary.activeCount}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Currently available for redemption</span>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Remaining Credits</span>
            <span style={{ fontSize: "0.75rem", background: "#eff6ff", color: "#2563eb", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Pool</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1a8a82" }}>{summary.totalCredits}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Total service credits outstanding</span>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Sold History</span>
            <span style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>All Time</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{summary.totalSold}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Includes expired & exhausted plans</span>
        </div>
      </section>

      {/* Main Table Section */}
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
              className={`user-filter-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              All Packages ({customerPackages.length})
            </button>
            <button
              type="button"
              className={`user-filter-btn ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => setStatusFilter("active")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              Active ({summary.activeCount})
            </button>
            <button
              type="button"
              className={`user-filter-btn ${statusFilter === "exhausted" ? "active" : ""}`}
              onClick={() => setStatusFilter("exhausted")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              Exhausted
            </button>
            <button
              type="button"
              className={`user-filter-btn ${statusFilter === "expired" ? "active" : ""}`}
              onClick={() => setStatusFilter("expired")}
              style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
            >
              Expired
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search customer, phone or package..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
              width: "280px",
            }}
          />
        </div>

        {loading ? (
          <p style={{ color: "#64748b", fontStyle: "italic", padding: "2.5rem 0", textAlign: "center" }}>
            Loading customer packages...
          </p>
        ) : error ? (
          <div className="status-error">{error}</div>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
            <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "1.05rem" }}>No customer packages match your search or filter</p>
            {canCreate && (
              <Link to="/packages/sale" className="user-primary-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                + Sell New Package
              </Link>
            )}
          </div>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Package / Plan</th>
                  <th>Status</th>
                  <th>Credits Remaining</th>
                  <th>Purchase Date</th>
                  <th>Expiry Date</th>
                  <th>Invoice Ref</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((doc) => {
                  const cust = doc.customer || doc.customer_id;
                  const pkg = doc.package_master || doc.package_master_id;
                  const isActive = doc.status === "active";

                  return (
                    <tr key={doc.id || doc._id}>
                      <td>
                        {cust?.id || cust?._id ? (
                          <Link
                            to={`/packages/list?customerId=${cust.id || cust._id}`}
                            style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}
                          >
                            {cust.name || "Unknown Customer"} <span style={{ fontSize: "0.75rem", color: "#1a8a82" }}>↗</span>
                          </Link>
                        ) : (
                          <strong style={{ color: "#0f172a" }}>{cust?.name || "Unknown Customer"}</strong>
                        )}
                      </td>
                      <td>
                        {cust?.phone ? (
                          <span style={{ fontSize: "0.85rem", color: "#475569" }}>{cust.phone}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div>
                          <strong style={{ color: "#0f172a" }}>{pkg?.name || "Package Plan"}</strong>
                          {pkg?.type && (
                            <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>
                              {pkg.type === "membership" ? "Membership" : "Prepaid Bundle"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            background: isActive ? "#d1fae5" : doc.status === "exhausted" ? "#fef3c7" : "#fee2e2",
                            color: isActive ? "#065f46" : doc.status === "exhausted" ? "#92400e" : "#991b1b",
                          }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "1.05rem", color: isActive && doc.credits_remaining > 0 ? "#1a8a82" : "#64748b" }}>
                          {doc.credits_remaining ?? 0}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "0.25rem" }}>credits</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem", color: "#475569" }}>{formatDate(doc.purchase_date)}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem", color: !isActive ? "#ef4444" : "#475569", fontWeight: !isActive ? 600 : 400 }}>
                          {formatDate(doc.expiry_date)}
                        </span>
                      </td>
                      <td>
                        {doc.invoice_id ? (
                          <span style={{ fontSize: "0.8rem", background: "#f1f5f9", padding: "0.2rem 0.5rem", borderRadius: "4px", color: "#475569", fontFamily: "monospace" }}>
                            {doc.invoice_id}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
