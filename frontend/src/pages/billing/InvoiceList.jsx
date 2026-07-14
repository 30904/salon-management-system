import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { preciousApi } from "../../api";
import { formatInr } from "../../utils/earningsFormat.js";
import InvoiceDetail from "./InvoiceDetail.jsx";

/**
 * InvoiceList — GST-Compliant Invoices History & Management Page
 */
export default function InvoiceList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [paymentMode, setPaymentMode] = useState(searchParams.get("mode") || "all");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("status") || "all");

  // Selected invoice for modal preview
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  const fetchInvoices = useCallback(async (pageNo = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pageNo,
        limit: pagination.limit || 15,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (paymentMode !== "all") params.payment_mode = paymentMode;
      if (paymentStatus !== "all") params.payment_status = paymentStatus;

      const res = await preciousApi.listInvoices(params);
      if (res?.success || Array.isArray(res?.data)) {
        setInvoices(res.data || []);
        if (res.pagination) {
          setPagination({
            page: Number(res.pagination.page || pageNo),
            limit: Number(res.pagination.limit || 15),
            total: Number(res.pagination.total || (res.data || []).length),
            pages: Number(res.pagination.pages || 1),
          });
        }
      } else {
        setError(res?.message || "Failed to load invoices list.");
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err.response?.data?.message || "Server error while fetching invoices.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, paymentMode, paymentStatus, pagination.limit]);

  useEffect(() => {
    fetchInvoices(1);
  }, [searchQuery, paymentMode, paymentStatus]);

  // Summary KPIs calculated across current view or total
  const stats = useMemo(() => {
    const totalCount = pagination.total || invoices.length;
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.payment_status !== "void" ? (inv.grand_total || 0) : 0), 0);
    const totalGst = invoices.reduce((sum, inv) => sum + (inv.payment_status !== "void" ? (inv.total_tax || inv.totals?.tax_total || 0) : 0), 0);
    const voidCount = invoices.filter((inv) => inv.payment_status === "void").length;

    return { totalCount, totalCollected, totalGst, voidCount };
  }, [invoices, pagination.total]);

  return (
    <div style={{ padding: "1.75rem", minHeight: "100%", overflowY: "auto" }}>
      {/* ── Top Header & KPI Banner ──────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span className="pos-badge" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800" }}>
            📑 BILLING & GST RECORDS
          </span>
          <h1 style={{ margin: "0.35rem 0 0.15rem", fontSize: "1.75rem", fontWeight: "900", color: "#0f172a" }}>
            Tax Invoices History
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
            View, search, print, and audit all GST-compliant salon bills of supply.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            className="user-secondary-btn"
            onClick={() => fetchInvoices(pagination.page)}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "700" }}
          >
            🔄 Refresh List
          </button>
          <button
            type="button"
            className="user-primary-btn"
            onClick={() => navigate("/billing")}
            style={{ background: "#10b981", display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "700", padding: "0.6rem 1.25rem" }}
          >
            + New POS Sale →
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Total Records Found</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", marginTop: "0.25rem" }}>{stats.totalCount} Bills</div>
          <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: "600" }}>● Active POS Database</span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Page Revenue (Excl. Void)</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#166534", marginTop: "0.25rem" }}>{formatInr(stats.totalCollected)}</div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Gross collected across view</span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Total GST / Tax Collected</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#2563eb", marginTop: "0.25rem" }}>{formatInr(stats.totalGst)}</div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>GOI Tax liabilities accrued</span>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Voided / Cancelled</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "900", color: stats.voidCount > 0 ? "#dc2626" : "#64748b", marginTop: "0.25rem" }}>{stats.voidCount} Bills</div>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Reversed in inventory & credits</span>
        </div>
      </div>

      {/* ── Filters & Search Bar ─────────────────────────────────────────── */}
      <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: "1 1 340px" }}>
          {/* Search Bar */}
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
            <input
              type="text"
              placeholder="Search by Invoice No, Customer Name or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.35rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
            />
          </div>

          {/* Payment Mode Filter */}
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", background: "#f8fafc", color: "#0f172a", fontWeight: "600" }}
          >
            <option value="all">💳 All Payment Modes</option>
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI / QR</option>
            <option value="card">💳 Card (POS)</option>
            <option value="split">✂️ Multi-Mode Split</option>
            <option value="package_credits">🎁 Package Credits</option>
            <option value="other">🎟️ Other / Voucher</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", background: "#f8fafc", color: "#0f172a", fontWeight: "600" }}
          >
            <option value="all">⚡ All Statuses</option>
            <option value="paid">✅ Paid</option>
            <option value="partial">⏳ Partial Payment</option>
            <option value="unpaid">⚠️ Unpaid</option>
            <option value="void">🚫 Voided / Cancelled</option>
          </select>
        </div>

        {(searchQuery || paymentMode !== "all" || paymentStatus !== "all") && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setPaymentMode("all"); setPaymentStatus("all"); }}
            style={{ background: "none", border: "none", color: "#dc2626", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {error && <div className="status-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* ── Invoices Data Table ──────────────────────────────────────────── */}
      <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#64748b" }}>
            <div className="pos-spinner" style={{ margin: "0 auto 1rem", width: "36px", height: "36px", border: "4px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ fontWeight: "600", fontSize: "1rem" }}>Loading Invoices Database...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
            <h3 style={{ margin: "0 0 0.4rem", color: "#0f172a", fontSize: "1.2rem" }}>No Invoices Found</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem" }}>No GST invoices match your current search query or filter criteria.</p>
            <button type="button" className="user-primary-btn" onClick={() => navigate("/billing")} style={{ background: "#10b981" }}>
              + Create First POS Sale
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "1rem 1.25rem" }}>Invoice Number</th>
                  <th style={{ padding: "1rem 1.25rem" }}>Date & Time</th>
                  <th style={{ padding: "1rem 1.25rem" }}>Customer Details</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "center" }}>Items</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "center" }}>Payment Mode</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "right" }}>GST / Tax</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "right" }}>Grand Total</th>
                  <th style={{ padding: "1rem 1.25rem", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const invNumber = inv.invoice_number || `INV-${String(inv._id || inv.id).slice(-6).toUpperCase()}`;
                  const invDate = new Date(inv.billing_date || inv.createdAt || Date.now()).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
                  const isVoid = inv.payment_status === "void";
                  const itemsCount = inv.line_items?.length || 0;

                  return (
                    <tr
                      key={inv._id || inv.id}
                      style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.9rem", transition: "background 0.15s ease", background: isVoid ? "#fef2f2" : "transparent" }}
                    >
                      <td style={{ padding: "1rem 1.25rem", fontWeight: "800", color: "#0f172a" }}>
                        <span
                          style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => setSelectedInvoiceId(inv._id || inv.id)}
                        >
                          {invNumber}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", color: "#475569", whiteSpace: "nowrap" }}>
                        {invDate}
                      </td>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>{inv.customer_name || "Walk-in Customer"}</strong>
                        {inv.customer_phone ? (
                          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>📞 {inv.customer_phone}</span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>No phone</span>
                        )}
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                        <span style={{ background: "#f1f5f9", color: "#334155", padding: "0.2rem 0.55rem", borderRadius: "6px", fontWeight: "700", fontSize: "0.8rem" }}>
                          {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#1e293b" }}>
                          {inv.payment_mode || "CASH"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "0.25rem 0.65rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", background: isVoid ? "#fecaca" : inv.payment_status === "paid" ? "#dcfce7" : "#fef9c3", color: isVoid ? "#b91c1c" : inv.payment_status === "paid" ? "#166534" : "#854d0e" }}>
                          {isVoid ? "VOID" : inv.payment_status?.toUpperCase() || "PAID"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "right", color: "#64748b", fontWeight: "600" }}>
                        {formatInr(inv.total_tax || inv.totals?.tax_total || 0)}
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "right", fontWeight: "900", color: isVoid ? "#991b1b" : "#0f172a", fontSize: "1rem" }}>
                        {formatInr(inv.grand_total || 0)}
                      </td>
                      <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="user-secondary-btn"
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                            onClick={() => setSelectedInvoiceId(inv._id || inv.id)}
                            title="View GST Details & Print"
                          >
                            👁️ View / Print
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

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", background: "#f8fafc", borderTop: "1px solid #e2e8f0", flexWrap: "wrap", gap: "1rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} total invoices)
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="user-secondary-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchInvoices(pagination.page - 1)}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", opacity: pagination.page <= 1 ? 0.5 : 1 }}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="user-secondary-btn"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchInvoices(pagination.page + 1)}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", opacity: pagination.page >= pagination.pages ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Invoice Detail Preview Modal ───────────────────────────────────── */}
      {selectedInvoiceId && (
        <InvoiceDetail
          invoiceId={selectedInvoiceId}
          isModal={true}
          onClose={() => setSelectedInvoiceId(null)}
          onInvoiceVoided={(updatedInv) => {
            setInvoices((prev) => prev.map((inv) => ((inv._id || inv.id) === (updatedInv._id || updatedInv.id) ? updatedInv : inv)));
          }}
        />
      )}
    </div>
  );
}
