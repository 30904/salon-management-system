import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerSearchOrCreate from "../../components/customers/CustomerSearchOrCreate.jsx";
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

export default function PackageSale() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canSell = hasPermission("billing", "create");

  // State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [packageList, setPackageList] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [errorPackages, setErrorPackages] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment State
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdSale, setCreatedSale] = useState(null);

  // Load active packages on mount
  useEffect(() => {
    let isMounted = true;
    async function loadPackages() {
      setLoadingPackages(true);
      setErrorPackages(null);
      try {
        const res = await preciousApi.fetchActivePackageMasters({ is_active: true });
        if (isMounted) {
          const list = res?.data || (Array.isArray(res) ? res : []);
          setPackageList(list.filter((p) => p.is_active !== false));
        }
      } catch (err) {
        if (isMounted) {
          setErrorPackages("Failed to load package templates. Please try again or check connection.");
          console.error("fetchActivePackageMasters error:", err);
        }
      } finally {
        if (isMounted) setLoadingPackages(false);
      }
    }
    loadPackages();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter package options
  const filteredPackages = useMemo(() => {
    return packageList.filter((pkg) => {
      if (filterType !== "all" && pkg.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (pkg.name || "").toLowerCase().includes(q);
        const matchType = (pkg.type || "").toLowerCase().includes(q);
        return matchName || matchType;
      }
      return true;
    });
  }, [packageList, filterType, searchQuery]);

  // Estimated expiry calculation for preview
  const estimatedExpiryDate = useMemo(() => {
    if (!selectedPackage) return null;
    const days = Number(selectedPackage.validity_days) || 30;
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return formatDate(target);
  }, [selectedPackage]);

  // Submit Handler
  async function handleConfirmSale(e) {
    if (e) e.preventDefault();
    setSubmitError(null);

    if (!selectedCustomer) {
      setSubmitError("Please select or create a customer before proceeding.");
      return;
    }
    if (!selectedPackage) {
      setSubmitError("Please choose a package or membership to sell.");
      return;
    }
    if (!canSell) {
      setSubmitError("You do not have permission to sell packages or process payments.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id || selectedCustomer._id,
        package_master_id: selectedPackage.id || selectedPackage._id,
        purchase_date: new Date().toISOString(),
        invoice_id: invoiceReference.trim() ? invoiceReference.trim() : `PKG-POS-${Date.now().toString().slice(-6)}`,
        payment_mode: paymentMode,
      };

      const res = await preciousApi.sellCustomerPackage(payload);
      if (res && res.data) {
        setCreatedSale(res.data);
      } else if (res && (res.id || res._id)) {
        setCreatedSale(res);
      } else {
        setCreatedSale({
          ...payload,
          customer: selectedCustomer,
          package_master: selectedPackage,
          status: "active",
          credits_remaining: selectedPackage.credit_count || 0,
          expiry_date: new Date(Date.now() + (Number(selectedPackage.validity_days) || 30) * 86400000).toISOString(),
        });
      }
    } catch (err) {
      console.error("sellCustomerPackage error:", err);
      const msg = err?.response?.data?.message || err?.message || "Error creating customer package sale.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetSaleForm() {
    setSelectedPackage(null);
    setInvoiceReference("");
    setSubmitError(null);
    setCreatedSale(null);
  }

  // Render Success Screen if package sold
  if (createdSale) {
    const cust = createdSale.customer || selectedCustomer;
    const pkg = createdSale.package_master || selectedPackage;

    return (
      <div className="page-wrap" style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
        <div
          className="status-card"
          style={{
            background: "var(--s21-surface, #ffffff)",
            borderRadius: "18px",
            border: "1px solid #e8edf3",
            boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
            padding: "2.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#d1fae5",
              color: "#065f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              margin: "0 auto 1.5rem",
              fontWeight: "bold",
            }}
          >
            ✓
          </div>
          <h1 style={{ fontSize: "1.75rem", color: "#0f172a", marginBottom: "0.5rem", fontWeight: 700 }}>
            Package Activated Successfully!
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "2rem" }}>
            The package has been assigned to the customer and is ready for immediate service redemptions.
          </p>

          <div
            style={{
              background: "#f8fafc",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              padding: "1.5rem",
              textAlign: "left",
              marginBottom: "2rem",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Customer
                </span>
                <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{cust?.name || "Customer"}</strong>
                {cust?.phone && <div style={{ fontSize: "0.85rem", color: "#475569" }}>{cust.phone}</div>}
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Package / Membership
                </span>
                <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{pkg?.name}</strong>
                <div style={{ fontSize: "0.85rem", color: "#1a8a82", fontWeight: 600 }}>
                  {pkg?.type === "membership" ? "Membership Plan" : "Prepaid Bundle"}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Assigned Credits
                </span>
                <strong style={{ fontSize: "1.25rem", color: "#0f172a" }}>
                  {createdSale.credits_remaining ?? pkg?.credit_count ?? 0} Credits
                </strong>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Validity & Expiry
                </span>
                <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
                  Valid until {formatDate(createdSale.expiry_date)}
                </strong>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{pkg?.validity_days || 30} days duration</div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Amount Paid
                </span>
                <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatInr(pkg?.price || 0)}</strong>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Mode: {paymentMode}</div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Reference / Invoice
                </span>
                <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                  {createdSale.invoice_id || "Direct POS Sale"}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={resetSaleForm}
              className="user-primary-btn"
              style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem", borderRadius: "10px" }}
            >
              + Sell Another Package
            </button>
            <Link
              to="/packages"
              className="user-secondary-btn"
              style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem", borderRadius: "10px", textDecoration: "none" }}
            >
              View All Active Packages →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Top Breadcrumb & Hero Banner */}
      <div style={{ marginBottom: "1.75rem" }}>
        <Link
          to="/packages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "#64748b",
            fontSize: "0.875rem",
            textDecoration: "none",
            marginBottom: "0.75rem",
            fontWeight: 500,
          }}
        >
          ← Back to Packages & Memberships
        </Link>
        <section
          style={{
            background: "linear-gradient(135deg, #0f3d3e 0%, #1a8a82 100%)",
            borderRadius: "18px",
            padding: "1.5rem 1.75rem",
            color: "#ffffff",
            boxShadow: "0 18px 40px rgba(15, 61, 62, 0.12)",
          }}
        >
          <p className="dashboard-hero__eyebrow" style={{ color: "rgba(248, 250, 252, 0.72)", margin: "0 0 0.25rem" }}>
            POS & Customer Bundles
          </p>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.75rem", fontWeight: 700 }}>Package Sale & Activation</h1>
          <p style={{ margin: 0, fontSize: "0.925rem", color: "rgba(248, 250, 252, 0.85)", maxWidth: "680px" }}>
            Select a salon customer, choose an active prepaid bundle or membership tier, and complete payment to instantly activate credits.
          </p>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.75rem", alignItems: "start" }}>
        {/* Left Column: Customer & Package Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Step 1: Customer Selection */}
          <section
            className="status-card"
            style={{
              background: "var(--s21-surface, #ffffff)",
              borderRadius: "18px",
              border: "1px solid #e8edf3",
              boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#1a8a82",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                1
              </span>
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 600 }}>
                Select or Create Customer
              </h2>
            </div>

            <CustomerSearchOrCreate
              value={selectedCustomer}
              onChange={(customer) => setSelectedCustomer(customer)}
              label="Customer for Package Assignment"
              required={true}
              touchLarge={false}
            />
          </section>

          {/* Step 2: Package Selection Grid */}
          <section
            className="status-card"
            style={{
              background: "var(--s21-surface, #ffffff)",
              borderRadius: "18px",
              border: "1px solid #e8edf3",
              boxShadow: "0 10px 30px rgba(16, 42, 67, 0.06)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#1a8a82",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  2
                </span>
                <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 600 }}>
                  Choose Package Template
                </h2>
              </div>

              {/* Filter Row */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`user-filter-btn ${filterType === "all" ? "active" : ""}`}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  All ({packageList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("prepaid_bundle")}
                  className={`user-filter-btn ${filterType === "prepaid_bundle" ? "active" : ""}`}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  Prepaid Bundles
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("membership")}
                  className={`user-filter-btn ${filterType === "membership" ? "active" : ""}`}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  Memberships
                </button>
              </div>
            </div>

            {/* Search within packages */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                type="text"
                placeholder="Search package name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.85rem",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {loadingPackages ? (
              <p style={{ color: "#64748b", fontStyle: "italic", padding: "2rem 0", textAlign: "center" }}>
                Loading available package templates...
              </p>
            ) : errorPackages ? (
              <div className="status-error" style={{ marginBottom: "1rem" }}>
                {errorPackages}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "12px" }}>
                <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>No active package templates found</p>
                <p style={{ fontSize: "0.85rem", margin: 0 }}>
                  Make sure you have created and activated package templates under Settings → Packages.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
                {filteredPackages.map((pkg) => {
                  const isSelected = selectedPackage?.id === pkg.id || selectedPackage?._id === pkg._id;
                  const isMembership = pkg.type === "membership";

                  return (
                    <div
                      key={pkg.id || pkg._id}
                      onClick={() => setSelectedPackage(pkg)}
                      style={{
                        borderRadius: "14px",
                        border: isSelected ? "2px solid #1a8a82" : "1px solid #e2e8f0",
                        background: isSelected ? "#f0fdfa" : "#ffffff",
                        padding: "1.25rem",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        boxShadow: isSelected ? "0 8px 20px rgba(26, 138, 130, 0.12)" : "0 2px 8px rgba(16, 42, 67, 0.03)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minHeight: "180px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a", fontWeight: 600 }}>
                            {pkg.name}
                          </h3>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: isMembership ? "#eff6ff" : "#f1f5f9",
                              color: isMembership ? "#2563eb" : "#475569",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isMembership ? "Membership" : "Prepaid"}
                          </span>
                        </div>

                        <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1a8a82", marginBottom: "0.75rem" }}>
                          {formatInr(pkg.price || 0)}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span>💳</span>
                            <strong>{pkg.credit_count || 0} Credits</strong> included
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span>📅</span>
                            <span>Valid for <strong>{pkg.validity_days || 30} days</strong></span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px dashed #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: isSelected ? "#0d9488" : "#64748b",
                        }}
                      >
                        <span>{isSelected ? "✓ Selected" : "Click to select"}</span>
                        <span>→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Checkout & Payment Summary Card */}
        <div style={{ position: "sticky", top: "1.5rem" }}>
          <section
            className="status-card"
            style={{
              background: "var(--s21-surface, #ffffff)",
              borderRadius: "18px",
              border: "1px solid #e8edf3",
              boxShadow: "0 14px 35px rgba(16, 42, 67, 0.08)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#1a8a82",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                3
              </span>
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 600 }}>
                Payment & Sale Summary
              </h2>
            </div>

            {/* Selected Items Breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Selected Customer
                </span>
                {selectedCustomer ? (
                  <div>
                    <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{selectedCustomer.name}</strong>
                    {selectedCustomer.phone && (
                      <span style={{ color: "#64748b", fontSize: "0.85rem", marginLeft: "0.5rem" }}>({selectedCustomer.phone})</span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "0.875rem", fontStyle: "italic" }}>No customer selected</span>
                )}
              </div>

              <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Selected Package
                </span>
                {selectedPackage ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{selectedPackage.name}</strong>
                      <span style={{ color: "#1a8a82", fontWeight: 700 }}>{formatInr(selectedPackage.price)}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                      {selectedPackage.credit_count || 0} Credits • Valid until {estimatedExpiryDate}
                    </div>
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "0.875rem", fontStyle: "italic" }}>No package selected</span>
                )}
              </div>
            </div>

            {/* Payment Options */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.5rem" }}>
                Payment Mode
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {["Cash", "Card", "UPI", "Split"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    style={{
                      padding: "0.6rem 0.5rem",
                      borderRadius: "8px",
                      border: paymentMode === mode ? "2px solid #1a8a82" : "1px solid #cbd5e1",
                      background: paymentMode === mode ? "#f0fdfa" : "#ffffff",
                      color: paymentMode === mode ? "#0d9488" : "#475569",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice Reference Input */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                Reference / Invoice ID <span style={{ fontWeight: 400, color: "#94a3b8" }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-1049"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Total Computation */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "1rem",
                borderTop: "1px solid #e2e8f0",
                marginBottom: "1.5rem",
              }}
            >
              <span style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>Total Payable</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a8a82" }}>
                {selectedPackage ? formatInr(selectedPackage.price) : "₹0"}
              </span>
            </div>

            {submitError && (
              <div className="status-error" style={{ marginBottom: "1.25rem", fontSize: "0.85rem", padding: "0.75rem" }}>
                {submitError}
              </div>
            )}

            {/* Confirm Sale Button */}
            <button
              type="button"
              onClick={handleConfirmSale}
              disabled={isSubmitting || !selectedCustomer || !selectedPackage || !canSell}
              className="user-primary-btn"
              style={{
                width: "100%",
                padding: "0.85rem",
                fontSize: "1rem",
                fontWeight: 600,
                borderRadius: "10px",
                background: !selectedCustomer || !selectedPackage || !canSell ? "#94a3b8" : "#1a8a82",
                cursor: !selectedCustomer || !selectedPackage || !canSell ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(26, 138, 130, 0.25)",
              }}
            >
              {isSubmitting ? "Activating Package..." : "Complete Package Sale"}
            </button>

            {!canSell && (
              <p style={{ fontSize: "0.75rem", color: "#ef4444", textAlign: "center", marginTop: "0.5rem" }}>
                Permission required (`billing:create`) to sell packages.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
