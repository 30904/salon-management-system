import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { preciousApi } from "../../api";
import { formatInr } from "../../utils/earningsFormat.js";
import { usePermission } from "../../hooks/usePermission.js";
import InvoiceDetail from "./InvoiceDetail.jsx";

function pageNumbers(current, pages) {
  const windowSize = 7;
  if (pages <= windowSize) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  let start = Math.max(1, current - 3);
  let end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function InvoicePager({ pagination, onPage }) {
  const pages = Math.max(1, Number(pagination.pages) || 1);
  const page = Number(pagination.page) || 1;
  const numbers = pageNumbers(page, pages);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "0.85rem 0",
      }}
    >
      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Page <strong style={{ color: "#0f172a" }}>{page}</strong> of <strong style={{ color: "#0f172a" }}>{pages}</strong>
        {" · "}
        {pagination.total} invoices
      </span>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="user-secondary-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", opacity: page <= 1 ? 0.45 : 1 }}
        >
          ← Previous
        </button>
        {numbers[0] > 1 ? (
          <button type="button" className="user-secondary-btn" onClick={() => onPage(1)} style={{ padding: "0.4rem 0.65rem", fontSize: "0.85rem" }}>
            1
          </button>
        ) : null}
        {numbers.map((number) => (
          <button
            key={number}
            type="button"
            className={number === page ? "user-primary-btn" : "user-secondary-btn"}
            onClick={() => onPage(number)}
            style={{
              padding: "0.4rem 0.65rem",
              fontSize: "0.85rem",
              minWidth: "2.25rem",
            }}
          >
            {number}
          </button>
        ))}
        {numbers[numbers.length - 1] < pages ? (
          <button type="button" className="user-secondary-btn" onClick={() => onPage(pages)} style={{ padding: "0.4rem 0.65rem", fontSize: "0.85rem" }}>
            {pages}
          </button>
        ) : null}
        <button
          type="button"
          className="user-secondary-btn"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", opacity: page >= pages ? 0.45 : 1 }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * InvoiceList — GST-Compliant Invoices History & Management Page (Dashboard Theme)
 */
export default function InvoiceList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermission();
  const canDelete = hasPermission("billing", "edit");

  // State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [deletingId, setDeletingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

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

  async function handleDeleteInvoice(inv) {
    const invId = inv._id || inv.id;
    const invNumber =
      inv.invoice_number || `INV-${String(invId).slice(-6).toUpperCase()}`;
    const amount = formatInr(inv.grand_total || inv.totals?.grand_total || 0);

    const confirmed = window.confirm(
      `Delete invoice ${invNumber} (${amount})?\n\nThis permanently removes the invoice and reverses stock, package credits, commissions, and dashboard sales.\n\nManager salon commission (e.g. Raksha) will recalculate from remaining invoices.\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(invId);
    setActionMessage(null);
    setError(null);
    try {
      const res = await preciousApi.deleteInvoice(invId);
      if (res?.success === false) {
        throw new Error(res?.message || "Failed to delete invoice.");
      }
      setActionMessage(res?.message || `Invoice ${invNumber} deleted.`);
      if (selectedInvoiceId && String(selectedInvoiceId) === String(invId)) {
        setSelectedInvoiceId(null);
      }
      await fetchInvoices(pagination.page);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to delete invoice.";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  }

  // Summary KPIs calculated across current view or total
  const stats = useMemo(() => {
    const totalCount = pagination.total || invoices.length;
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.payment_status !== "void" ? (inv.grand_total || 0) : 0), 0);
    const totalGst = invoices.reduce((sum, inv) => sum + (inv.payment_status !== "void" ? (inv.total_tax || inv.totals?.tax_total || 0) : 0), 0);
    const voidCount = invoices.filter((inv) => inv.payment_status === "void").length;

    return { totalCount, totalCollected, totalGst, voidCount };
  }, [invoices, pagination.total]);

  return (
    <div className="page-wrap">
      {/* Top Hero Banner */}
      <section
        style={{
          background: "var(--s21-teal-gradient)",
          border: "1px solid var(--s21-teal-gradient-border)",
          boxShadow: "var(--s21-teal-gradient-shadow)",
          padding: "1.75rem 2rem",
          color: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <p className="dashboard-hero__eyebrow" style={{ margin: "0 0 0.25rem" }}>
            POS & Financial Auditing
          </p>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.85rem", fontWeight: 500 }}>
            Tax Invoices History
          </h1>
          <p className="dashboard-hero__subtitle" style={{ maxWidth: "620px" }}>
            View, search, print, and audit all GST-compliant salon bills of supply and multi-mode payment splits.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => fetchInvoices(pagination.page)}
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
            ↻ Refresh List
          </button>
          <button
            type="button"
            className="user-primary-btn"
            onClick={() => navigate("/billing")}
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
            + New POS Sale →
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Records Found</span>
            <span style={{ fontSize: "0.75rem", background: "#eff6ff", color: "#2563eb", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Bills</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{stats.totalCount}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Active POS database records</span>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Page Revenue</span>
            <span style={{ fontSize: "0.75rem", background: "#d1fae5", color: "#065f46", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Gross</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1a8a82" }}>{formatInr(stats.totalCollected)}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Gross collected across current view</span>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total GST Accrued</span>
            <span style={{ fontSize: "0.75rem", background: "#e0e7ff", color: "#3730a3", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Tax</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{formatInr(stats.totalGst)}</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>GOI Tax liabilities accrued</span>
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
            <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Voided / Cancelled</span>
            <span style={{ fontSize: "0.75rem", background: stats.voidCount > 0 ? "#fee2e2" : "#f1f5f9", color: stats.voidCount > 0 ? "#991b1b" : "#475569", padding: "0.15rem 0.6rem", borderRadius: "999px", fontWeight: 600 }}>Reversed</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: stats.voidCount > 0 ? "#dc2626" : "#64748b" }}>{stats.voidCount} Bills</div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Reversed stock & packages</span>
        </div>
      </section>

      {/* Filter & Search Bar + Invoices Table inside user-table-card */}
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
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: "1 1 360px" }}>
            <input
              type="text"
              placeholder="Search by Invoice No, Customer Name or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: "1 1 240px", padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
            />

            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              style={{ padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", fontWeight: 600 }}
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI / QR</option>
              <option value="card">Card (POS)</option>
              <option value="split">Multi-Mode Split</option>
              <option value="package_credits">Package Credits</option>
              <option value="other">Other / Voucher</option>
            </select>

            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{ padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", fontWeight: 600 }}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial Payment</option>
              <option value="unpaid">Unpaid</option>
              <option value="void">Voided / Cancelled</option>
            </select>
          </div>

          {(searchQuery || paymentMode !== "all" || paymentStatus !== "all") && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setPaymentMode("all"); setPaymentStatus("all"); }}
              style={{ background: "none", border: "none", color: "#dc2626", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {!loading && invoices.length > 0 ? (
          <InvoicePager pagination={pagination} onPage={fetchInvoices} />
        ) : null}

        {error && <div className="status-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}
        {actionMessage && !error && (
          <div
            className="status-success"
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {actionMessage}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#64748b", fontStyle: "italic", padding: "3rem 0", textAlign: "center" }}>
            Loading Invoices Database...
          </p>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
            <h3 style={{ margin: "0 0 0.4rem", color: "#0f172a", fontSize: "1.2rem" }}>No Invoices Found</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem" }}>No GST invoices match your current search query or filter criteria.</p>
            <button type="button" className="user-primary-btn" onClick={() => navigate("/billing")}>
              + Create First POS Sale
            </button>
          </div>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Date & Time</th>
                  <th>Customer Details</th>
                  <th style={{ textAlign: "center" }}>Items</th>
                  <th style={{ textAlign: "center" }}>Payment Mode</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>GST / Tax</th>
                  <th style={{ textAlign: "right" }}>Grand Total</th>
                  <th style={{ textAlign: "center", width: canDelete ? "220px" : "120px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const invNumber = inv.invoice_number || `INV-${String(inv._id || inv.id).slice(-6).toUpperCase()}`;
                  const invDate = new Date(inv.billing_date || inv.createdAt || Date.now()).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
                  const isVoid = inv.payment_status === "void";
                  const itemsCount = inv.line_items?.length || 0;
                  const rowId = inv._id || inv.id;
                  const isDeleting = String(deletingId) === String(rowId);

                  return (
                    <tr
                      key={rowId}
                      style={{ background: isVoid ? "#fef2f2" : "transparent" }}
                    >
                      <td>
                        <span
                          style={{ color: "#1a8a82", fontWeight: 700, cursor: "pointer" }}
                          onClick={() => setSelectedInvoiceId(inv._id || inv.id)}
                        >
                          {invNumber}
                        </span>
                      </td>
                      <td style={{ color: "#475569", whiteSpace: "nowrap" }}>
                        {invDate}
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a", display: "block" }}>{inv.customer_name || "Walk-in Customer"}</strong>
                        {inv.customer_phone ? (
                          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>📞 {inv.customer_phone}</span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>No phone</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#f1f5f9", color: "#334155", padding: "0.2rem 0.55rem", borderRadius: "6px", fontWeight: 600, fontSize: "0.8rem" }}>
                          {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#1e293b" }}>
                          {inv.payment_mode || "CASH"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isVoid ? "#fee2e2" : inv.payment_status === "paid" ? "#d1fae5" : "#fef3c7",
                            color: isVoid ? "#991b1b" : inv.payment_status === "paid" ? "#065f46" : "#92400e",
                          }}
                        >
                          {isVoid ? "VOID" : inv.payment_status?.toUpperCase() || "PAID"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "#64748b", fontWeight: 600 }}>
                        {formatInr(inv.total_tax || inv.totals?.tax_total || 0)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: isVoid ? "#991b1b" : "#0f172a", fontSize: "1rem" }}>
                        {formatInr(inv.grand_total || 0)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="user-secondary-btn"
                            style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", fontWeight: 600 }}
                            onClick={() => setSelectedInvoiceId(rowId)}
                            title="View GST Details & Print"
                          >
                            View / Print
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              className="user-secondary-btn"
                              disabled={Boolean(deletingId)}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteInvoice(inv);
                              }}
                              title="Permanently delete invoice and reverse finance"
                              style={{
                                padding: "0.4rem 0.8rem",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: "#991b1b",
                                borderColor: "#fecaca",
                                background: "#fef2f2",
                                opacity: isDeleting ? 0.7 : 1,
                              }}
                            >
                              {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && invoices.length > 0 ? (
          <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "0.5rem" }}>
            <InvoicePager pagination={pagination} onPage={fetchInvoices} />
          </div>
        ) : null}
      </section>

      {/* Invoice Detail Preview Modal */}
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
