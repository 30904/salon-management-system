import React, { useState, useEffect } from "react";
import { createPackageMaster, updatePackageMaster } from "../../../api/packageMasterApi.js";
import "../attendance/AttendanceSettings.css";

export default function PackageMasterForm({ selectedPackage, onClose, onSuccess }) {
  const [name, setName] = useState(selectedPackage?.name || "");
  const [type, setType] = useState(selectedPackage?.type || "prepaid_bundle");
  const [validityDays, setValidityDays] = useState(selectedPackage?.validity_days || 30);
  const [price, setPrice] = useState(selectedPackage?.price || 0);
  const [creditCount, setCreditCount] = useState(selectedPackage?.credit_count || 5);
  const [isActive, setIsActive] = useState(selectedPackage?.is_active !== undefined ? selectedPackage.is_active : true);

  // Included services UI helper (for prepaid_bundle)
  const [includedServices, setIncludedServices] = useState(() => {
    if (Array.isArray(selectedPackage?.included_services) && selectedPackage.included_services.length > 0) {
      return selectedPackage.included_services;
    }
    return [{ service_name: "Hair Spa / Facial Sitting", sittings_allowed: 5 }];
  });

  // Discount logic UI helper (for membership)
  const [discountServicesPct, setDiscountServicesPct] = useState(() => {
    return selectedPackage?.discount_logic_json?.services_discount_pct || 20;
  });
  const [discountProductsPct, setDiscountProductsPct] = useState(() => {
    return selectedPackage?.discount_logic_json?.products_discount_pct || 10;
  });
  const [tierNote, setTierNote] = useState(() => {
    return selectedPackage?.discount_logic_json?.tier_note || "VIP Gold Member Benefits";
  });
  const [rawDiscountJson, setRawDiscountJson] = useState(() => {
    return JSON.stringify(
      selectedPackage?.discount_logic_json || {
        services_discount_pct: 20,
        products_discount_pct: 10,
        tier_note: "VIP Gold Member Benefits",
      },
      null,
      2
    );
  });
  const [useRawJson, setUseRawJson] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!useRawJson) {
      const updatedObj = {
        services_discount_pct: Number(discountServicesPct) || 0,
        products_discount_pct: Number(discountProductsPct) || 0,
        tier_note: tierNote,
      };
      setRawDiscountJson(JSON.stringify(updatedObj, null, 2));
    }
  }, [discountServicesPct, discountProductsPct, tierNote, useRawJson]);

  const handleServiceChange = (index, field, val) => {
    setIncludedServices((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: val } : item))
    );
  };

  const handleAddServiceRow = () => {
    setIncludedServices((prev) => [
      ...prev,
      { service_name: `Special Service #${prev.length + 1}`, sittings_allowed: 3 },
    ]);
  };

  const handleRemoveServiceRow = (index) => {
    setIncludedServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let finalDiscountJson = {};
      if (type === "membership") {
        if (useRawJson) {
          try {
            finalDiscountJson = JSON.parse(rawDiscountJson);
          } catch (parseErr) {
            throw new Error("Invalid Discount Logic JSON structure. Please check syntax.");
          }
        } else {
          finalDiscountJson = {
            services_discount_pct: Number(discountServicesPct) || 0,
            products_discount_pct: Number(discountProductsPct) || 0,
            tier_note: tierNote,
          };
        }
      }

      const payload = {
        name: name.trim(),
        type,
        validity_days: Number(validityDays) || 30,
        price: Number(price) || 0,
        included_services: type === "prepaid_bundle" ? includedServices : [],
        credit_count: type === "prepaid_bundle" ? Number(creditCount) || 0 : 0,
        discount_logic_json: type === "membership" ? finalDiscountJson : {},
        is_active: isActive,
      };

      if (selectedPackage) {
        await updatePackageMaster(selectedPackage.id || selectedPackage._id, payload);
      } else {
        await createPackageMaster(payload);
      }

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save package definition.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="staff-form-modal" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 className="modal-title">
          {selectedPackage ? "Edit Package / Membership Definition" : "Create New Package / Membership"}
        </h2>
        <p className="modal-sub">
          Configure prepaid multi-sitting bundles or recurring VIP membership discount tiers.
        </p>

        {error && <div className="status-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Type Selector Tabs */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.5rem" }}>
              Package Master Type *
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setType("prepaid_bundle")}
                style={{
                  padding: "0.85rem",
                  borderRadius: "10px",
                  border: type === "prepaid_bundle" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                  background: type === "prepaid_bundle" ? "#eef2ff" : "#f8fafc",
                  color: type === "prepaid_bundle" ? "#312e81" : "#475569",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                Prepaid Multi-Sitting Bundle
                <div style={{ fontSize: "0.75rem", fontWeight: 400, marginTop: "0.2rem", color: "#64748b" }}>
                  Allocates session credits / specific sitting counts
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("membership")}
                style={{
                  padding: "0.85rem",
                  borderRadius: "10px",
                  border: type === "membership" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                  background: type === "membership" ? "#eef2ff" : "#f8fafc",
                  color: type === "membership" ? "#312e81" : "#475569",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                VIP Membership Tier
                <div style={{ fontSize: "0.75rem", fontWeight: 400, marginTop: "0.2rem", color: "#64748b" }}>
                  Applies recurring % discounts on services & products
                </div>
              </button>
            </div>
          </div>

          <div className="form-grid-2col" style={{ marginBottom: "1.25rem" }}>
            <div className="form-group full-width">
              <label htmlFor="pkg_name">Package / Membership Title *</label>
              <input
                id="pkg_name"
                type="text"
                className="form-control"
                placeholder="e.g. 10x Hair Spa Saver Bundle, Platinum Club Annual VIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pkg_price">Selling Price (₹) *</label>
              <input
                id="pkg_price"
                type="number"
                min="0"
                step="any"
                className="form-control"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pkg_validity">Validity Duration (Days) *</label>
              <input
                id="pkg_validity"
                type="number"
                min="1"
                className="form-control"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                required
              />
            </div>
          </div>

          {/* DYNAMIC SUBSECTION: Prepaid Bundle UI Helper */}
          {type === "prepaid_bundle" && (
            <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Included Services & Sitting Credits Helper</h4>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Define the exact services and sitting quotas granted when this bundle is sold.
                  </p>
                </div>
                <button type="button" className="btn-add-leave" onClick={handleAddServiceRow}>
                  + Add Service Row
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Total Combined Credit Unit Count *</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  style={{ maxWidth: "200px" }}
                  value={creditCount}
                  onChange={(e) => setCreditCount(e.target.value)}
                  required
                />
                <small style={{ color: "#64748b" }}>Used as summary balance tracking across salon POS checkouts.</small>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="leave-quota-table">
                  <thead>
                    <tr>
                      <th>Service Name / Category Included</th>
                      <th style={{ width: "160px" }}>Sittings Allowed</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {includedServices.map((srv, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            style={{ padding: "0.4rem 0.6rem" }}
                            value={srv.service_name || ""}
                            placeholder="e.g. Keratin Treatment Sitting"
                            onChange={(e) => handleServiceChange(idx, "service_name", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            style={{ padding: "0.4rem 0.6rem" }}
                            value={srv.sittings_allowed !== undefined ? srv.sittings_allowed : ""}
                            onChange={(e) => handleServiceChange(idx, "sittings_allowed", Number(e.target.value))}
                            required
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn-icon-action danger"
                            onClick={() => handleRemoveServiceRow(idx)}
                            title="Remove Row"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DYNAMIC SUBSECTION: Membership Discount Logic UI Helper */}
          {type === "membership" && (
            <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Membership Discount Logic Engine (JSON)</h4>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Governs automatic percentage deductions across billing POS checkouts.
                  </p>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "#4f46e5", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={useRawJson}
                    onChange={(e) => setUseRawJson(e.target.checked)}
                  />
                  Advanced Raw JSON Mode
                </label>
              </div>

              {!useRawJson ? (
                <div className="form-grid-2col">
                  <div className="form-group">
                    <label>Services Discount Slab (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={discountServicesPct}
                      onChange={(e) => setDiscountServicesPct(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Retail Products Discount Slab (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={discountProductsPct}
                      onChange={(e) => setDiscountProductsPct(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Tier Benefit Note / Perks Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={tierNote}
                      onChange={(e) => setTierNote(e.target.value)}
                      placeholder="e.g. Free Welcome Drink + Priority Weekend Booking"
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group full-width">
                  <label>Raw `discount_logic_json` Specification *</label>
                  <textarea
                    className="form-control"
                    rows="6"
                    style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                    value={rawDiscountJson}
                    onChange={(e) => setRawDiscountJson(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#1e293b", color: "#38bdf8", borderRadius: "8px", fontFamily: "monospace", fontSize: "0.8rem", overflowX: "auto" }}>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Live Evaluated JSON Output:</div>
                {rawDiscountJson}
              </div>
            </div>
          )}

          <div className="form-group full-width" style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active Package / Membership Definition (Available for sale at POS)
            </label>
          </div>

          <div className="modal-footer full-width">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Saving Definition..." : selectedPackage ? "Update Package Master" : "Create Package Master"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
