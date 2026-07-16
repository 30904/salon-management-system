import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { preciousApi } from "../../api";
import { formatInr } from "../../utils/earningsFormat.js";

/**
 * InvoiceDetail — GST-Compliant Tax Invoice Display & Print View
 * Can be rendered as a standalone page (when accessed via /invoices/:id)
 * OR embedded as a modal (`isModal={true}`, `invoiceId={id}`, `onClose={fn}`).
 */
export default function InvoiceDetail({ invoiceId: propInvoiceId, isModal = false, onClose, onInvoiceVoided }) {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const invoiceId = propInvoiceId || paramId;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voiding state
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidError, setVoidError] = useState(null);

  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await preciousApi.getInvoice(invoiceId);
        if (res?.success && res.data) {
          setInvoice(res.data);
        } else if (res?.data) {
          setInvoice(res.data);
        } else {
          setError("Invoice not found or failed to load details.");
        }
      } catch (err) {
        console.error("Failed to load invoice details:", err);
        setError(err.response?.data?.message || "Error fetching invoice details from server.");
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [invoiceId]);

  const handleVoidInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceId) return;
    setIsVoiding(true);
    setVoidError(null);
    try {
      const res = await preciousApi.voidInvoice(invoiceId, { reason: voidReason.trim() });
      if (res?.success || res?.data) {
        const updated = res.data?.invoice || { ...invoice, payment_status: "void", notes: (invoice.notes ? invoice.notes + " | " : "") + `VOIDED: ${voidReason.trim()}` };
        setInvoice(updated);
        setShowVoidModal(false);
        if (onInvoiceVoided) onInvoiceVoided(updated);
      } else {
        setVoidError(res?.message || "Failed to void invoice.");
      }
    } catch (err) {
      console.error("Void invoice error:", err);
      setVoidError(err.response?.data?.message || "Only Owner/Manager can void invoices, or server error occurred.");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleBack = () => {
    if (isModal && onClose) {
      onClose();
    } else {
      navigate("/invoices");
    }
  };

  const handlePrint = () => {
    if (!invoice) return;

    const lineItemsHtml = (invoice.line_items || []).map((li, idx) => {
      const qty = Number(li.quantity || 1);
      const rate = Number(li.unit_price || 0);
      const disc = Number(li.discount_amount || 0);
      const taxAmt = Number(li.tax_amount || 0);
      const taxRate = Number(li.tax_rate || 0);
      const lineTotal = li.total_amount ?? (rate * qty - disc + taxAmt);
      const stylistName = li.staff_name || (li.staff_id ? `Staff #${String(li.staff_id).slice(-4)}` : "Assigned Stylist");
      const typeBg = li.item_type === "service" ? "#eff6ff" : li.item_type === "product" ? "#fdf4ff" : "#f0fdf4";
      const typeColor = li.item_type === "service" ? "#2563eb" : li.item_type === "product" ? "#a21caf" : "#166534";
      return `
        <tr style="border-bottom:1px solid #e2e8f0;font-size:0.9rem;">
          <td style="padding:0.75rem;color:#64748b;font-weight:600;">${idx + 1}</td>
          <td style="padding:0.75rem;">
            <strong style="color:#0f172a;display:block;">${li.item_name || ""}</strong>
            <span style="font-size:0.75rem;color:#475569;background:#f8fafc;padding:0.15rem 0.45rem;border-radius:4px;border:1px solid #cbd5e1;">Stylist: ${stylistName}</span>
            ${li.package_redemption_id ? '<span style="font-size:0.75rem;color:#166534;background:#dcfce7;padding:0.15rem 0.45rem;border-radius:4px;font-weight:700;margin-left:0.5rem;">Package Credit</span>' : ""}
          </td>
          <td style="padding:0.75rem;text-align:center;">
            <span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:6px;font-weight:700;text-transform:uppercase;background:${typeBg};color:${typeColor};">${li.item_type || "item"}</span>
          </td>
          <td style="padding:0.75rem;text-align:center;font-weight:700;">${qty}</td>
          <td style="padding:0.75rem;text-align:right;">&#8377;${rate.toFixed(2)}</td>
          <td style="padding:0.75rem;text-align:right;color:${disc > 0 ? "#dc2626" : "#94a3b8"}">${disc > 0 ? "\u2212&#8377;" + disc.toFixed(2) : "&#8377;0"}</td>
          <td style="padding:0.75rem;text-align:right;"><div style="font-weight:700;">&#8377;${taxAmt.toFixed(2)}</div>${taxRate > 0 ? `<small style="font-size:0.75rem;color:#64748b;">(${taxRate}% GST)</small>` : ""}</td>
          <td style="padding:0.75rem;text-align:right;font-weight:800;color:#0f172a;">&#8377;${Number(lineTotal).toFixed(2)}</td>
        </tr>`;
    }).join("");

    const splitHtml = invoice.payment_mode === "split" && Array.isArray(invoice.split_payments) && invoice.split_payments.length > 0
      ? invoice.split_payments.map(sp => `<div style="display:flex;justify-content:space-between;font-size:0.9rem;background:#fff;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:0.25rem;"><strong style="text-transform:uppercase;">${sp.mode}:</strong><span>&#8377;${Number(sp.amount || 0).toFixed(2)}${sp.reference_id ? " (#" + sp.reference_id + ")" : ""}</span></div>`).join("")
      : `<p style="margin:0.35rem 0;font-size:0.95rem;">Paid via <strong>${(invoice.payment_mode || "CASH").toUpperCase()}</strong></p>`;

    const isVoidInv = invoice.payment_status === "void";
    const inv_number = invoice.invoice_number || `INV-${String(invoice._id || invoice.id).slice(-6).toUpperCase()}`;
    const inv_date = new Date(invoice.billing_date || invoice.createdAt || Date.now()).toLocaleString();
    const t = invoice.totals || {};
    const subtotal = t.subtotal ?? invoice.subtotal ?? 0;
    const discTotal = t.discount_total ?? invoice.total_discount ?? 0;
    const taxTotal = t.tax_total ?? invoice.total_tax ?? 0;
    const grandTotal = t.grand_total ?? invoice.grand_total ?? 0;
    const amtPaid = t.amount_paid ?? (invoice.payment_status === "paid" ? grandTotal : 0);
    const amtDue = t.amount_due ?? 0;
    const statusBg = isVoidInv ? "#fef2f2" : invoice.payment_status === "paid" ? "#dcfce7" : "#fef9c3";
    const statusColor = isVoidInv ? "#dc2626" : invoice.payment_status === "paid" ? "#166534" : "#a16207";
    const statusLabel = isVoidInv ? "VOID" : (invoice.payment_status || "paid").toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tax Invoice ${inv_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; padding: 2rem; font-size: 14px; }
    h1 { font-size: 1.85rem; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 0.35rem; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
    th { background: #f1f5f9; padding: 0.75rem; font-size: 0.82rem; font-weight: 800; text-align: left; border-bottom: 2px solid #cbd5e1; }
    td { padding: 0.75rem; vertical-align: top; }
    @media print {
      body { padding: 1cm; }
      @page { size: A4; margin: 1.5cm; }
    }
  </style>
</head>
<body>
  ${isVoidInv ? `<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:1rem;margin-bottom:1.5rem;color:#991b1b;"><strong style="font-size:1.1rem;">VOIDED TAX INVOICE</strong><br/><span>This invoice has been cancelled. All stock and commissions have been restored.</span>${invoice.notes ? "<div style='margin-top:0.25rem;font-style:italic;'>Notes: " + invoice.notes + "</div>" : ""}</div>` : ""}

  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:1.25rem;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap;">
    <div>
      <span style="display:inline-block;background:#0f172a;color:#fff;padding:0.2rem 0.6rem;border-radius:5px;font-size:0.72rem;font-weight:800;letter-spacing:1px;margin-bottom:0.5rem;">TAX INVOICE / BILL OF SUPPLY</span>
      <h1>S21 SALON MANAGEMENT SYSTEM</h1>
      <p style="color:#475569;font-size:0.88rem;margin-top:0.25rem;">Branch: Terminal 1 &bull; Main High Street Salon Studio</p>
      <p style="color:#475569;font-size:0.88rem;"><strong>GSTIN / Tax ID:</strong> 27AABCS1429B1Z5 &bull; State Code: 27 (Maharashtra)</p>
    </div>
    <div style="text-align:right;background:#f8fafc;padding:1rem 1.2rem;border-radius:10px;border:1px solid #e2e8f0;min-width:220px;">
      <div style="font-size:0.78rem;color:#64748b;text-transform:uppercase;font-weight:700;">Invoice Number</div>
      <div style="font-size:1.35rem;font-weight:900;margin:0.1rem 0 0.5rem;">${inv_number}</div>
      <div style="font-size:0.78rem;color:#64748b;">Date &amp; Time</div>
      <div style="font-size:0.92rem;font-weight:700;color:#334155;">${inv_date}</div>
      <div style="margin-top:0.65rem;display:flex;justify-content:flex-end;gap:0.5rem;">
        <span style="background:${statusBg};color:${statusColor};padding:0.2rem 0.6rem;border-radius:5px;font-size:0.72rem;font-weight:800;">${statusLabel}</span>
        <span style="background:#e0f2fe;color:#0369a1;padding:0.2rem 0.6rem;border-radius:5px;font-size:0.72rem;font-weight:800;">MODE: ${(invoice.payment_mode || "CASH").toUpperCase()}</span>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;background:#f8fafc;padding:1.1rem;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:1.5rem;">
    <div>
      <span style="font-size:0.78rem;color:#64748b;font-weight:700;text-transform:uppercase;">Billed To (Customer)</span>
      <h3 style="margin:0.3rem 0 0.2rem;font-size:1.1rem;font-weight:800;">${invoice.customer_name || "Walk-in Customer"}</h3>
      <p style="font-size:0.88rem;color:#334155;">${invoice.customer_phone ? "Phone: " + invoice.customer_phone : "<em style='color:#94a3b8;'>No contact number provided</em>"}</p>
    </div>
    <div>
      <span style="font-size:0.78rem;color:#64748b;font-weight:700;text-transform:uppercase;">Payment Breakdown</span>
      <div style="margin-top:0.3rem;">${splitHtml}</div>
    </div>
  </div>

  <h4 style="font-size:1rem;font-weight:800;margin-bottom:0.65rem;display:flex;justify-content:space-between;">
    <span>Itemized Bill &amp; Tax Breakdown (${(invoice.line_items || []).length} items)</span>
    <span style="font-size:0.78rem;color:#64748b;font-weight:normal;">All prices in INR (&#8377;)</span>
  </h4>
  <table style="margin-bottom:1.75rem;">
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Item Description &amp; Staff Attribution</th>
        <th style="width:80px;text-align:center;">Type</th>
        <th style="width:60px;text-align:center;">Qty</th>
        <th style="width:100px;text-align:right;">Rate</th>
        <th style="width:100px;text-align:right;">Discount</th>
        <th style="width:110px;text-align:right;">GST / Tax</th>
        <th style="width:110px;text-align:right;">Line Total</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:2rem;flex-wrap:wrap;">
    <div style="flex:1 1 280px;max-width:420px;background:#f8fafc;padding:1.1rem;border-radius:10px;border:1px solid #cbd5e1;">
      <h5 style="margin-bottom:0.5rem;font-size:0.88rem;text-transform:uppercase;font-weight:800;">Terms &amp; GST Compliance Notice</h5>
      <p style="font-size:0.78rem;color:#475569;line-height:1.4;margin-bottom:0.35rem;">1. All services and products include applicable GST as per GOI regulations.</p>
      <p style="font-size:0.78rem;color:#475569;line-height:1.4;margin-bottom:0.35rem;">2. Goods once sold are non-refundable. For service feedback contact branch manager within 48 hours.</p>
      <p style="font-size:0.78rem;color:#475569;line-height:1.4;">3. This is an electronically generated tax invoice (Atomic Transaction Record).</p>
    </div>
    <div style="flex:1 1 260px;max-width:340px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:1.1rem;">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;font-size:0.92rem;color:#475569;"><span>Subtotal (Gross):</span><strong>&#8377;${Number(subtotal).toFixed(2)}</strong></div>
      ${discTotal > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;font-size:0.92rem;color:#dc2626;"><span>Discounts:</span><strong>&minus;&#8377;${Number(discTotal).toFixed(2)}</strong></div>` : ""}
      <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:0.92rem;color:#475569;padding-bottom:0.75rem;border-bottom:1px solid #cbd5e1;"><span>Total GST:</span><strong>+&#8377;${Number(taxTotal).toFixed(2)}</strong></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.75rem;font-size:1.2rem;font-weight:900;color:#166534;padding-bottom:0.75rem;border-bottom:2px solid #cbd5e1;"><span>Grand Total Due:</span><span>&#8377;${Number(grandTotal).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#334155;margin-bottom:0.35rem;"><span>Amount Paid:</span><strong>&#8377;${Number(amtPaid).toFixed(2)}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:${amtDue > 0 ? "#dc2626" : "#166534"};"><span>Balance Remaining:</span><strong>${amtDue > 0 ? "&#8377;" + Number(amtDue).toFixed(2) : "&#8377;0.00 (Fully Settled)"}</strong></div>
    </div>
  </div>

  <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;align-items:flex-end;color:#64748b;font-size:0.83rem;">
    <div><strong>Thank you for choosing S21 Salon Studio!</strong><br/>We look forward to welcoming you back soon.</div>
    <div style="text-align:right;"><div style="border-bottom:1px solid #94a3b8;width:160px;margin-bottom:0.3rem;"></div><span>Authorized Signatory / Cashier</span></div>
  </div>
</body>
</html>`;

    const popup = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
    if (!popup) {
      alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    // Small delay so styles render before print dialog opens
    setTimeout(() => { popup.print(); }, 400);
  };

  if (loading) {
    const loadingContent = (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        <div className="pos-spinner" style={{ margin: "0 auto 1rem", width: "40px", height: "40px", border: "4px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>Loading GST Invoice Details...</p>
      </div>
    );
    if (isModal) {
      return (
        <div className="pos-modal-backdrop" onClick={handleBack}>
          <div className="pos-modal" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>📄 Invoice #{invoiceId?.slice(-6)?.toUpperCase()}</h3>
              <button type="button" className="pos-modal-close" onClick={handleBack}>✕</button>
            </div>
            {loadingContent}
          </div>
        </div>
      );
    }
    return <div className="pos-screen" style={{ padding: "2rem" }}>{loadingContent}</div>;
  }

  if (error || !invoice) {
    const errorContent = (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem", color: "#dc2626", fontWeight: "800" }}>!</div>
        <h3 style={{ color: "#0f172a", marginBottom: "0.5rem" }}>Unable to Load Invoice</h3>
        <p style={{ color: "#dc2626", marginBottom: "1.5rem" }}>{error || "Invoice record could not be retrieved."}</p>
        <button type="button" className="user-primary-btn" onClick={handleBack}>
          ← Back to Invoice List
        </button>
      </div>
    );
    if (isModal) {
      return (
        <div className="pos-modal-backdrop" onClick={handleBack}>
          <div className="pos-modal" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>📄 Error</h3>
              <button type="button" className="pos-modal-close" onClick={handleBack}>✕</button>
            </div>
            {errorContent}
          </div>
        </div>
      );
    }
    return <div className="pos-screen" style={{ padding: "2rem" }}>{errorContent}</div>;
  }

  // Extract variables
  const invNumber = invoice.invoice_number || `INV-${String(invoice._id || invoice.id).slice(-6).toUpperCase()}`;
  const invDate = new Date(invoice.billing_date || invoice.createdAt || Date.now()).toLocaleString();
  const isVoid = invoice.payment_status === "void";
  const lineItems = invoice.line_items || [];
  const totals = invoice.totals || {
    subtotal: invoice.subtotal || 0,
    discount_total: invoice.discount_total || invoice.total_discount || 0,
    tax_total: invoice.tax_total || invoice.total_tax || 0,
    grand_total: invoice.grand_total || 0,
    amount_paid: invoice.amount_paid || (invoice.payment_status === "paid" ? invoice.grand_total : 0),
    amount_due: invoice.amount_due || 0,
  };

  const invoiceBodyContent = (
    <>
      {/* Top Action Bar (Screen View Only - hidden on print) */}
      <div className="pos-inv-action-bar no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button type="button" className="user-secondary-btn" onClick={handleBack} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "700" }}>
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#0f172a", fontWeight: "500" }}>
              📄 Tax Invoice #{invNumber}
            </h2>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Generated on {invDate}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {!isVoid && (
            <button
              type="button"
              className="user-secondary-btn"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              onClick={() => { setVoidError(null); setVoidReason(""); setShowVoidModal(true); }}
            >
              Void / Cancel Bill
            </button>
          )}
          <button
            type="button"
            className="user-primary-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "700", padding: "0.6rem 1.25rem" }}
            onClick={handlePrint}
          >
            🖨️ Print / Download PDF
          </button>
        </div>
      </div>

      {/* Main GST Invoice Display Area (Both screen view + print view compatible) */}
      <div className="pos-inv-sheet" style={{ padding: "2rem", background: "#ffffff", color: "#0f172a" }}>
        {/* Void Alert Banner */}
        {isVoid && (
          <div style={{ background: "#fef2f2", border: "2px solid #dc2626", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.75rem", color: "#991b1b", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "#dc2626" }}>!</span>
            <div>
              <strong style={{ display: "block", fontSize: "1.1rem" }}>VOIDED TAX INVOICE</strong>
              <span>This invoice has been cancelled. All product stock, package credits, and staff commissions have been atomically restored.</span>
              {invoice.notes && <div style={{ marginTop: "0.25rem", fontStyle: "italic", fontSize: "0.9rem" }}>Notes: {invoice.notes}</div>}
            </div>
          </div>
        )}

        {/* Salon Header & GSTIN Box */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <span style={{ display: "inline-block", background: "#0f172a", color: "#ffffff", padding: "0.25rem 0.65rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", letterSpacing: "1px", marginBottom: "0.5rem" }}>
              TAX INVOICE / BILL OF SUPPLY
            </span>
            <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.85rem", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
              S21 SALON MANAGEMENT SYSTEM
            </h1>
            <p style={{ margin: "0.15rem 0", fontSize: "0.9rem", color: "#475569" }}>
              📍 Branch: Terminal 1 • Main High Street Salon Studio
            </p>
            <p style={{ margin: "0.15rem 0", fontSize: "0.9rem", color: "#475569" }}>
              🏢 <strong>GSTIN / Tax ID:</strong> 27AABCS1429B1Z5 • State Code: 27 (Maharashtra)
            </p>
          </div>

          <div style={{ textAlign: "right", background: "#f8fafc", padding: "1rem 1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", minWidth: "240px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Invoice Number</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "900", color: "#0f172a", margin: "0.1rem 0 0.5rem" }}>{invNumber}</div>
            
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Date & Timestamp</div>
            <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#334155" }}>{invDate}</div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
              <span style={{ display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", background: isVoid ? "#fef2f2" : invoice.payment_status === "paid" ? "#dcfce7" : "#fef9c3", color: isVoid ? "#dc2626" : invoice.payment_status === "paid" ? "#166534" : "#a16207" }}>
                {isVoid ? "VOID" : invoice.payment_status?.toUpperCase() || "PAID"}
              </span>
              <span style={{ display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", background: "#e0f2fe", color: "#0369a1" }}>
                Mode: {invoice.payment_mode?.toUpperCase() || "CASH"}
              </span>
            </div>
          </div>
        </div>

        {/* Customer & Billing Details Section */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #cbd5e1", marginBottom: "1.75rem" }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>👤 Billed To (Customer)</span>
            <h3 style={{ margin: "0.35rem 0 0.2rem", fontSize: "1.15rem", fontWeight: "800", color: "#0f172a" }}>
              {invoice.customer_name || "Walk-in Customer"}
            </h3>
            {invoice.customer_phone ? (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>📞 Phone: {invoice.customer_phone}</p>
            ) : (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", fontStyle: "italic" }}>No contact number provided</p>
            )}
            {invoice.customer_id && (
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginTop: "0.25rem" }}>Customer ID: {String(invoice.customer_id).slice(-6).toUpperCase()}</span>
            )}
          </div>

          <div>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Payment Breakdown</span>
            {invoice.payment_mode === "split" && Array.isArray(invoice.split_payments) && invoice.split_payments.length > 0 ? (
              <div style={{ marginTop: "0.35rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {invoice.split_payments.map((sp, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", background: "#ffffff", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <strong style={{ textTransform: "uppercase", color: "#334155" }}>{sp.mode}:</strong>
                    <span>{formatInr(sp.amount || 0)} {sp.reference_id ? `(#${sp.reference_id})` : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: "0.35rem" }}>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.95rem", color: "#334155" }}>
                  Paid via <strong>{invoice.payment_mode?.toUpperCase() || "CASH"}</strong>
                </p>
                {invoice.payment_status === "partial" && (
                  <span style={{ color: "#d97706", fontSize: "0.85rem", fontWeight: "700" }}>
                    Partial Payment (`₹${totals.amount_paid}` paid, `₹${totals.amount_due}` due)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GST Line Items Table */}
        <h4 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: "800", color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Itemized Bill & Tax Breakdown ({lineItems.length} items)</span>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "normal" }}>All prices in INR (₹)</span>
        </h4>

        <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#0f172a", textAlign: "left", fontSize: "0.85rem", fontWeight: "800", borderBottom: "2px solid #cbd5e1" }}>
                <th style={{ padding: "0.85rem 0.75rem", width: "50px" }}>#</th>
                <th style={{ padding: "0.85rem 0.75rem" }}>Item Description & Staff Attribution</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "90px", textAlign: "center" }}>Type</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "80px", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "110px", textAlign: "right" }}>Rate</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "110px", textAlign: "right" }}>Discount</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "130px", textAlign: "right" }}>GST / Tax</th>
                <th style={{ padding: "0.85rem 0.75rem", width: "130px", textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => {
                const qty = Number(li.quantity || 1);
                const rate = Number(li.unit_price || 0);
                const disc = Number(li.discount_amount || 0);
                const taxAmt = Number(li.tax_amount || 0);
                const taxRate = Number(li.tax_rate || 0);
                const lineTotal = li.total_amount ?? (rate * qty - disc + taxAmt);
                const stylistName = li.staff_name || (li.staff_id ? `Staff #${String(li.staff_id).slice(-4)}` : "Assigned Stylist");

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", fontSize: "0.9rem" }}>
                    <td style={{ padding: "0.85rem 0.75rem", color: "#64748b", fontWeight: "600" }}>{idx + 1}</td>
                    <td style={{ padding: "0.85rem 0.75rem" }}>
                      <strong style={{ color: "#0f172a", display: "block", fontSize: "0.95rem" }}>{li.item_name}</strong>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.2rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "#475569", background: "#f8fafc", padding: "0.15rem 0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                          Stylist: {stylistName}
                        </span>
                        {li.package_redemption_id && (
                          <span style={{ fontSize: "0.75rem", color: "#166534", background: "#dcfce7", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: "700" }}>
                            Package Credit Redeemed
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "6px", fontWeight: "700", textTransform: "uppercase", background: li.item_type === "service" ? "#eff6ff" : li.item_type === "product" ? "#fdf4ff" : "#f0fdf4", color: li.item_type === "service" ? "#2563eb" : li.item_type === "product" ? "#a21caf" : "#166534" }}>
                        {li.item_type || "Item"}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "center", fontWeight: "700", color: "#334155" }}>{qty}</td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "right", color: "#334155" }}>{formatInr(rate)}</td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "right", color: disc > 0 ? "#dc2626" : "#94a3b8", fontWeight: disc > 0 ? "700" : "normal" }}>
                      {disc > 0 ? `−${formatInr(disc)}` : "₹0"}
                    </td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "right" }}>
                      <div style={{ fontWeight: "700", color: taxAmt > 0 ? "#0f172a" : "#64748b" }}>{formatInr(taxAmt)}</div>
                      {taxRate > 0 && <small style={{ fontSize: "0.75rem", color: "#64748b" }}>({taxRate}% GST)</small>}
                    </td>
                    <td style={{ padding: "0.85rem 0.75rem", textAlign: "right", fontWeight: "800", color: "#0f172a", fontSize: "0.95rem" }}>
                      {formatInr(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* GST Breakdown & Final Grand Totals */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "2rem" }}>
          {/* Left Side: Notes & Terms */}
          <div style={{ flex: "1 1 300px", maxWidth: "480px" }}>
            <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
              <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#0f172a", textTransform: "uppercase", fontWeight: "800" }}>
                📜 Terms & GST Compliance Notice
              </h5>
              <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "#475569", lineHeight: "1.4" }}>
                1. All services and retail products sold include applicable Goods and Services Tax (GST) as per GOI regulations.
              </p>
              <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "#475569", lineHeight: "1.4" }}>
                2. Goods once sold are non-refundable. For service feedback, please contact the branch manager within 48 hours.
              </p>
              <p style={{ margin: "0", fontSize: "0.8rem", color: "#475569", lineHeight: "1.4" }}>
                3. This is an electronically generated tax invoice (`Atomic Transaction Record`).
              </p>
            </div>
          </div>

          {/* Right Side: Calculation Sheet */}
          <div style={{ flex: "1 1 280px", maxWidth: "380px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem", fontSize: "0.95rem", color: "#475569" }}>
              <span>Subtotal (Gross):</span>
              <strong style={{ color: "#0f172a" }}>{formatInr(totals.subtotal || 0)}</strong>
            </div>

            {(totals.discount_total || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem", fontSize: "0.95rem", color: "#dc2626" }}>
                <span>Discounts & Redemptions:</span>
                <strong>−{formatInr(totals.discount_total)}</strong>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8rem", fontSize: "0.95rem", color: "#475569", paddingBottom: "0.8rem", borderBottom: "1px solid #cbd5e1" }}>
              <span>Total GST (Taxes):</span>
              <strong style={{ color: "#0f172a" }}>+{formatInr(totals.tax_total || 0)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.8rem", fontSize: "1.25rem", fontWeight: "900", color: "#166534", paddingBottom: "0.8rem", borderBottom: "2px solid #cbd5e1" }}>
              <span>Grand Total Due:</span>
              <span>{formatInr(totals.grand_total || 0)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#334155", marginBottom: "0.4rem" }}>
              <span>Amount Paid:</span>
              <strong>{formatInr(totals.amount_paid || 0)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: (totals.amount_due || 0) > 0 ? "#dc2626" : "#166534" }}>
              <span>Balance Remaining:</span>
              <strong>{(totals.amount_due || 0) > 0 ? formatInr(totals.amount_due) : "₹0.00 (Fully Settled)"}</strong>
            </div>
          </div>
        </div>

        {/* Footer Signature Bar */}
        <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px dashed #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "flex-end", color: "#64748b", fontSize: "0.85rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <strong>Thank you for choosing S21 Salon Studio!</strong><br />
            We look forward to welcoming you back soon.
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ borderBottom: "1px solid #94a3b8", width: "180px", marginBottom: "0.35rem" }} />
            <span>Authorized Signatory / Cashier</span>
          </div>
        </div>
      </div>
    </>
  );

  // If rendered as a Modal
  if (isModal) {
    return (
      <div className="pos-modal-backdrop" onClick={handleBack}>
        <div className="pos-modal" style={{ maxWidth: "860px", width: "95%", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
          <div className="pos-modal-header no-print">
            <h3>📄 Tax Invoice Preview #{invNumber}</h3>
            <button type="button" className="pos-modal-close" onClick={handleBack}>✕</button>
          </div>
          <div className="pos-modal-body" style={{ padding: 0 }}>
            {invoiceBodyContent}
          </div>
        </div>

        {/* Void Confirmation Modal */}
        {showVoidModal && (
          <div className="pos-modal-backdrop" style={{ zIndex: 100000 }} onClick={() => setShowVoidModal(false)}>
            <div className="pos-modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              <div className="pos-modal-header" style={{ background: "#fef2f2" }}>
                <h3 style={{ color: "#dc2626" }}>Confirm Invoice Void</h3>
                <button type="button" className="pos-modal-close" onClick={() => setShowVoidModal(false)}>✕</button>
              </div>
              <form onSubmit={handleVoidInvoice}>
                <div className="pos-modal-body">
                  <p style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "#334155" }}>
                    Are you sure you want to void invoice <strong>{invNumber}</strong>? This will immediately restore all product stock, refund any redeemed package credits, and reverse staff commission entries.
                  </p>
                  {voidError && <div className="status-error" style={{ marginBottom: "1rem" }}>{voidError}</div>}
                  <div className="inventory-form-group" style={{ margin: 0 }}>
                    <label>Reason for Voiding *</label>
                    <textarea
                      required
                      placeholder="e.g. Entered incorrect product, customer cancelled payment..."
                      rows={3}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>
                <div className="pos-modal-footer">
                  <button type="button" className="user-secondary-btn" onClick={() => setShowVoidModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="user-primary-btn" disabled={isVoiding} style={{ background: "#dc2626" }}>
                    {isVoiding ? "Voiding Invoice..." : "Confirm Void Bill"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standalone page view
  return (
    <div className="pos-screen" style={{ padding: "1.5rem" }}>
      {invoiceBodyContent}

      {/* Void Confirmation Modal */}
      {showVoidModal && (
        <div className="pos-modal-backdrop" style={{ zIndex: 100000 }} onClick={() => setShowVoidModal(false)}>
          <div className="pos-modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header" style={{ background: "#fef2f2" }}>
              <h3 style={{ color: "#dc2626" }}>Confirm Invoice Void</h3>
              <button type="button" className="pos-modal-close" onClick={() => setShowVoidModal(false)}>✕</button>
            </div>
            <form onSubmit={handleVoidInvoice}>
              <div className="pos-modal-body">
                <p style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "#334155" }}>
                  Are you sure you want to void invoice <strong>{invNumber}</strong>? This will immediately restore all product stock, refund any redeemed package credits, and reverse staff commission entries.
                </p>
                {voidError && <div className="status-error" style={{ marginBottom: "1rem" }}>{voidError}</div>}
                <div className="inventory-form-group" style={{ margin: 0 }}>
                  <label>Reason for Voiding *</label>
                  <textarea
                    required
                    placeholder="e.g. Entered incorrect product, customer cancelled payment..."
                    rows={3}
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="pos-modal-footer">
                <button type="button" className="user-secondary-btn" onClick={() => setShowVoidModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="user-primary-btn" disabled={isVoiding} style={{ background: "#dc2626" }}>
                  {isVoiding ? "Voiding Invoice..." : "Confirm Void Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
