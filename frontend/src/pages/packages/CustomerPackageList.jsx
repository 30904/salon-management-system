import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import CustomerSearchOrCreate from "../../components/customers/CustomerSearchOrCreate.jsx";
import { preciousApi, arnavApi } from "../../api";
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

function isPackageExpired(pkg) {
  if (!pkg) return false;
  if (pkg.status === "expired") return true;
  if (!pkg.expiry_date) return false;
  return new Date(pkg.expiry_date).getTime() < Date.now();
}

function getPackageComputedStatus(pkg) {
  if (!pkg) return "unknown";
  if (pkg.status === "cancelled") return "cancelled";
  if (isPackageExpired(pkg)) return "expired";
  if (pkg.status === "exhausted" || Number(pkg.credits_remaining || 0) <= 0) return "exhausted";
  return "active";
}

export default function CustomerPackageList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();
  const initialCustomerId = routeParams.customerId || searchParams.get("customerId") || null;

  const { hasPermission } = usePermission();
  const canSell = hasPermission("billing", "create");

  // State
  const [allPackages, setAllPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected customer for detailed view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // active, exhausted, expired, all
  const [searchQuery, setSearchQuery] = useState("");

  // Load all customer packages
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await preciousApi.listCustomerPackages();
        if (isMounted) {
          const list = res?.data || (Array.isArray(res) ? res : []);
          setAllPackages(list);

          // If URL provided a customerId, try to find or load that customer
          if (initialCustomerId && !selectedCustomer) {
            const foundInPkg = list.find(
              (p) =>
                (p.customer?.id === initialCustomerId || p.customer?._id === initialCustomerId ||
                 p.customer_id?.id === initialCustomerId || p.customer_id?._id === initialCustomerId ||
                 String(p.customer_id) === String(initialCustomerId))
            );
            if (foundInPkg) {
              const c = foundInPkg.customer || foundInPkg.customer_id;
              if (c && typeof c === "object") setSelectedCustomer(c);
            } else {
              // Try fetching customer details from API if available
              try {
                const custRes = await arnavApi.getCustomer(initialCustomerId);
                if (custRes?.data || custRes) setSelectedCustomer(custRes.data || custRes);
              } catch {
                // Ignore if customer lookup fails
              }
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load customer packages:", err);
          setError("Unable to retrieve customer package list. Please check network or try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialCustomerId]);

  // Handle customer selection change
  function handleCustomerSelect(customer) {
    setSelectedCustomer(customer);
    if (customer && (customer.id || customer._id)) {
      setSearchParams({ customerId: customer.id || customer._id });
    } else {
      setSearchParams({});
    }
  }

  // Filter packages belonging to the selected customer (if selected) or across all customers
  const customerSpecificPackages = useMemo(() => {
    if (!selectedCustomer) return [];
    const custId = String(selectedCustomer.id || selectedCustomer._id);
    return allPackages.filter((pkg) => {
      const pCust = pkg.customer || pkg.customer_id;
      const pId = String(pCust?.id || pCust?._id || pCust || "");
      return pId === custId;
    });
  }, [allPackages, selectedCustomer]);

  // Breakdown counts for the selected customer
  const customerStats = useMemo(() => {
    const pkgs = selectedCustomer ? customerSpecificPackages : allPackages;
    let active = 0;
    let exhausted = 0;
    let expired = 0;
    let totalCredits = 0;

    pkgs.forEach((p) => {
      const st = getPackageComputedStatus(p);
      if (st === "active") {
        active++;
        totalCredits += Number(p.credits_remaining || 0);
      } else if (st === "exhausted") {
        exhausted++;
      } else if (st === "expired") {
        expired++;
      }
    });

    return {
      total: pkgs.length,
      active,
      exhausted,
      expired,
      totalCredits,
    };
  }, [selectedCustomer, customerSpecificPackages, allPackages]);

  // Tab-filtered packages for the current view
  const displayPackages = useMemo(() => {
    const baseList = selectedCustomer ? customerSpecificPackages : allPackages;
    return baseList.filter((pkg) => {
      const st = getPackageComputedStatus(pkg);
      if (activeTab !== "all" && st !== activeTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cName = (pkg.customer?.name || pkg.customer_id?.name || "").toLowerCase();
        const cPhone = String(pkg.customer?.phone || pkg.customer_id?.phone || "");
        const pName = (pkg.package_master?.name || pkg.package_master_id?.name || "").toLowerCase();
        const invId = (pkg.invoice_id || "").toLowerCase();
        return cName.includes(q) || cPhone.includes(q) || pName.includes(q) || invId.includes(q);
      }
      return true;
    });
  }, [selectedCustomer, customerSpecificPackages, allPackages, activeTab, searchQuery]);

  // Grouped summary across all customers when no single customer is picked
  const groupedCustomerPortfolio = useMemo(() => {
    if (selectedCustomer) return [];
    const map = new Map();

    allPackages.forEach((pkg) => {
      const cust = pkg.customer || pkg.customer_id;
      const custId = String(cust?.id || cust?._id || cust || "unknown");
      const custName = cust?.name || "Unknown Customer";
      const custPhone = cust?.phone || "—";

      if (!map.has(custId)) {
        map.set(custId, {
          id: custId,
          name: custName,
          phone: custPhone,
          customerObj: typeof cust === "object" ? cust : { id: custId, name: custName, phone: custPhone },
          totalPlans: 0,
          activeCount: 0,
          exhaustedCount: 0,
          expiredCount: 0,
          remainingCredits: 0,
        });
      }

      const item = map.get(custId);
      item.totalPlans++;
      const st = getPackageComputedStatus(pkg);
      if (st === "active") {
        item.activeCount++;
        item.remainingCredits += Number(pkg.credits_remaining || 0);
      } else if (st === "exhausted") {
        item.exhaustedCount++;
      } else if (st === "expired") {
        item.expiredCount++;
      }
    });

    const list = Array.from(map.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter((c) => c.name.toLowerCase().includes(q) || String(c.phone).includes(q));
    }
    return list;
  }, [selectedCustomer, allPackages, searchQuery]);

  return (
    <div className="page-wrap">
      {/* Top Breadcrumb & Hero Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link
            to="/packages"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "#64748b",
              fontSize: "0.875rem",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← Back to Packages & Memberships Hub
          </Link>

          {selectedCustomer && (
            <button
              type="button"
              onClick={() => handleCustomerSelect(null)}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                padding: "0.35rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              ✕ Clear Customer Filter (Show All Portfolio)
            </button>
          )}
        </div>

        <section
          style={{
            background: "linear-gradient(135deg, #0f3d3e 0%, #1a8a82 100%)",
            borderRadius: "18px",
            padding: "1.6rem 2rem",
            color: "#ffffff",
            boxShadow: "0 18px 40px rgba(15, 61, 62, 0.12)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.25rem",
          }}
        >
          <div>
            <p className="dashboard-hero__eyebrow" style={{ color: "rgba(248, 250, 252, 0.72)", margin: "0 0 0.25rem" }}>
              Per-Customer Portfolio Breakdown
            </p>
            <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.8rem", fontWeight: 700 }}>
              {selectedCustomer ? `${selectedCustomer.name}'s Packages` : "Customer Package Portfolio"}
            </h1>
            <p style={{ margin: 0, fontSize: "0.925rem", color: "rgba(248, 250, 252, 0.85)", maxWidth: "660px" }}>
              {selectedCustomer
                ? `Detailed view of active redemptions, exhausted credit allocations, and expired plans for ${selectedCustomer.name}.`
                : "Select any client below to inspect their full active, expired, and exhausted package histories or search across all customer accounts."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {canSell && (
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
                + Assign Package to Customer
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Customer Selection Row */}
      <section
        className="status-card"
        style={{
          background: "var(--s21-surface, #ffffff)",
          borderRadius: "18px",
          border: "1px solid #e8edf3",
          boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
          padding: "1.5rem",
          marginBottom: "1.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: "1 1 400px", maxWidth: "600px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.5rem" }}>
              Filter by Specific Customer
            </label>
            <CustomerSearchOrCreate
              value={selectedCustomer}
              onChange={(cust) => handleCustomerSelect(cust)}
              label="Select customer to view exact portfolio"
              touchLarge={false}
            />
          </div>

          {selectedCustomer && (
            <div style={{ display: "flex", gap: "1.5rem", background: "#f8fafc", padding: "0.85rem 1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Contact</span>
                <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{selectedCustomer.phone || "No phone"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Email</span>
                <span style={{ color: "#475569", fontSize: "0.9rem" }}>{selectedCustomer.email || "—"}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* KPI Stats Row for Current Scope */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
        <div
          onClick={() => setActiveTab("active")}
          className="status-card"
          style={{
            background: activeTab === "active" ? "#f0fdfa" : "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: activeTab === "active" ? "2px solid #1a8a82" : "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Active & Live</span>
            <span style={{ fontSize: "0.75rem", background: "#d1fae5", color: "#065f46", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Available</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a" }}>{customerStats.active}</div>
          <span style={{ fontSize: "0.8rem", color: "#1a8a82", fontWeight: 600 }}>{customerStats.totalCredits} remaining credits</span>
        </div>

        <div
          onClick={() => setActiveTab("exhausted")}
          className="status-card"
          style={{
            background: activeTab === "exhausted" ? "#fffbeb" : "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: activeTab === "exhausted" ? "2px solid #f59e0b" : "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Exhausted Plans</span>
            <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>0 Credits</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a" }}>{customerStats.exhausted}</div>
          <span style={{ fontSize: "0.8rem", color: "#92400e" }}>Fully redeemed credits</span>
        </div>

        <div
          onClick={() => setActiveTab("expired")}
          className="status-card"
          style={{
            background: activeTab === "expired" ? "#fef2f2" : "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: activeTab === "expired" ? "2px solid #ef4444" : "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Expired Plans</span>
            <span style={{ fontSize: "0.75rem", background: "#fee2e2", color: "#991b1b", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Lapsed</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a" }}>{customerStats.expired}</div>
          <span style={{ fontSize: "0.8rem", color: "#991b1b" }}>Passed validity date</span>
        </div>

        <div
          onClick={() => setActiveTab("all")}
          className="status-card"
          style={{
            background: activeTab === "all" ? "#f8fafc" : "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: activeTab === "all" ? "2px solid #64748b" : "1px solid #e8edf3",
            boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
            padding: "1.25rem 1.5rem",
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Plans</span>
            <span style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>History</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a" }}>{customerStats.total}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Complete package audit</span>
        </div>
      </section>

      {/* Main Content Area */}
      {selectedCustomer ? (
        /* Detailed Packages List for Selected Customer */
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
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`user-filter-btn ${activeTab === "active" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
              >
                Active ({customerStats.active})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("exhausted")}
                className={`user-filter-btn ${activeTab === "exhausted" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
              >
                Exhausted ({customerStats.exhausted})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("expired")}
                className={`user-filter-btn ${activeTab === "expired" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
              >
                Expired ({customerStats.expired})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`user-filter-btn ${activeTab === "all" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
              >
                All History ({customerStats.total})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search package name or invoice..."
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

          {loading ? (
            <p style={{ color: "#64748b", fontStyle: "italic", padding: "2.5rem 0", textAlign: "center" }}>
              Loading {selectedCustomer.name}'s packages...
            </p>
          ) : error ? (
            <div className="status-error">{error}</div>
          ) : displayPackages.length === 0 ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
              <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "1.05rem" }}>
                No {activeTab === "all" ? "" : activeTab} packages found for {selectedCustomer.name}.
              </p>
              {canSell && (
                <Link to="/packages/sale" className="user-primary-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                  + Sell New Package to {selectedCustomer.name}
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "1.25rem" }}>
              {displayPackages.map((pkg) => {
                const pMaster = pkg.package_master || pkg.package_master_id;
                const status = getPackageComputedStatus(pkg);
                const isActive = status === "active";
                const isExhausted = status === "exhausted";
                const isExpired = status === "expired";

                return (
                  <div
                    key={pkg.id || pkg._id}
                    style={{
                      borderRadius: "16px",
                      border: isActive ? "2px solid #1a8a82" : isExhausted ? "1px solid #fcd34d" : "1px solid #fca5a5",
                      background: isActive ? "#ffffff" : isExhausted ? "#fffbeb" : "#fef2f2",
                      padding: "1.35rem",
                      boxShadow: "0 4px 12px rgba(16, 42, 67, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a", fontWeight: 700 }}>
                            {pMaster?.name || "Package Plan"}
                          </h3>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {pMaster?.type === "membership" ? "Membership Tier" : "Prepaid Bundle"}
                          </span>
                        </div>

                        <span
                          style={{
                            padding: "0.2rem 0.65rem",
                            borderRadius: "999px",
                            fontSize: "0.725rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isActive ? "#d1fae5" : isExhausted ? "#fef3c7" : "#fee2e2",
                            color: isActive ? "#065f46" : isExhausted ? "#92400e" : "#991b1b",
                          }}
                        >
                          {status}
                        </span>
                      </div>

                      <div
                        style={{
                          background: isActive ? "#f0fdfa" : "rgba(255,255,255,0.6)",
                          padding: "0.85rem 1rem",
                          borderRadius: "12px",
                          marginBottom: "1rem",
                          border: "1px solid rgba(0,0,0,0.05)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                            Credits Balance
                          </span>
                          <strong style={{ fontSize: "1.5rem", color: isActive ? "#1a8a82" : "#475569" }}>
                            {pkg.credits_remaining ?? 0}
                          </strong>
                          <span style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "0.25rem" }}>
                            / {pMaster?.credit_count ?? 0}
                          </span>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                            Price Paid
                          </span>
                          <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>
                            {formatInr(pMaster?.price || 0)}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.825rem", color: "#475569", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Purchased on:</span>
                          <strong style={{ color: "#0f172a" }}>{formatDate(pkg.purchase_date)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Valid until:</span>
                          <strong style={{ color: isExpired ? "#ef4444" : "#0f172a" }}>{formatDate(pkg.expiry_date)}</strong>
                        </div>
                        {pkg.invoice_id && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Invoice Ref:</span>
                            <span style={{ fontFamily: "monospace", color: "#334155" }}>{pkg.invoice_id}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ paddingTop: "0.75rem", borderTop: "1px dashed rgba(0,0,0,0.1)", display: "flex", gap: "0.5rem" }}>
                      {isActive && pkg.credits_remaining > 0 ? (
                        <Link
                          to={`/billing`}
                          className="user-primary-btn"
                          style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "0.5rem",
                            fontSize: "0.85rem",
                            borderRadius: "8px",
                            textDecoration: "none",
                          }}
                        >
                          Redeem in POS →
                        </Link>
                      ) : (
                        <Link
                          to={`/packages/sale`}
                          className="user-secondary-btn"
                          style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "0.5rem",
                            fontSize: "0.85rem",
                            borderRadius: "8px",
                            textDecoration: "none",
                          }}
                        >
                          + Renew / Top-up Plan
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* Grouped Customer Portfolio View across all accounts */
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
            <div>
              <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.15rem", color: "#0f172a", fontWeight: 700 }}>
                All Customers with Packages
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Click any client row to inspect their exact active, expired, and exhausted packages.
              </span>
            </div>

            <input
              type="text"
              placeholder="Search customer name or contact..."
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
              Loading all customer package accounts...
            </p>
          ) : error ? (
            <div className="status-error">{error}</div>
          ) : groupedCustomerPortfolio.length === 0 ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
              <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "1.05rem" }}>No customers own any packages yet</p>
              {canSell && (
                <Link to="/packages/sale" className="user-primary-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                  + Sell First Package
                </Link>
              )}
            </div>
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact Phone</th>
                    <th>Active Plans</th>
                    <th>Remaining Credits Pool</th>
                    <th>Exhausted Plans</th>
                    <th>Expired Plans</th>
                    <th>Total Plans Owned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCustomerPortfolio.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleCustomerSelect(item.customerObj)}
                      style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                    >
                      <td>
                        <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{item.name}</strong>
                      </td>
                      <td>
                        <span style={{ color: "#475569", fontSize: "0.875rem" }}>{item.phone}</span>
                      </td>
                      <td>
                        {item.activeCount > 0 ? (
                          <span style={{ background: "#d1fae5", color: "#065f46", padding: "0.2rem 0.6rem", borderRadius: "999px", fontWeight: 700, fontSize: "0.8rem" }}>
                            {item.activeCount} Active
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>0</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: item.remainingCredits > 0 ? "#1a8a82" : "#64748b", fontSize: "1.05rem" }}>
                          {item.remainingCredits}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: "0.25rem" }}>credits</span>
                      </td>
                      <td>
                        {item.exhaustedCount > 0 ? (
                          <span style={{ color: "#92400e", fontWeight: 600 }}>{item.exhaustedCount} Exhausted</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>0</span>
                        )}
                      </td>
                      <td>
                        {item.expiredCount > 0 ? (
                          <span style={{ color: "#991b1b", fontWeight: 600 }}>{item.expiredCount} Expired</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>0</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#334155" }}>{item.totalPlans} total</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="user-secondary-btn"
                          style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCustomerSelect(item.customerObj);
                          }}
                        >
                          View Portfolio →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
