import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { preciousApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { usePermission } from "../../hooks/usePermission.js";
import {
  InvoiceLineRedoActions,
  InvoiceRedoRequestModal,
  isWithinRedoWindow,
  lineStaffId,
} from "./InvoiceRedoControls.jsx";

/**
 * Feature 4 — Request redo (billing.edit).
 * Prefer opening from InvoiceDetail; this page supports ?invoiceId= for a dedicated route.
 */
export default function RedoRequestForm() {
  const { hasPermission } = usePermission();
  const canRequest = hasPermission("billing", "edit");
  const [searchParams] = useSearchParams();
  const invoiceId =
    searchParams.get("invoiceId") || searchParams.get("invoice_id") || "";

  const [invoice, setInvoice] = useState(null);
  const [relatedRedos, setRelatedRedos] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [windowDays, setWindowDays] = useState(7);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [redoFormLine, setRedoFormLine] = useState(null);

  const loadRelatedRedos = useCallback(async (id) => {
    if (!id) {
      setRelatedRedos([]);
      return;
    }
    try {
      const [byOriginal, byRedo] = await Promise.all([
        preciousApi.listRedoRequests({ original_invoice_id: id, limit: 100 }),
        preciousApi.listRedoRequests({ redo_invoice_id: id, limit: 100 }),
      ]);
      const items = [
        ...(byOriginal?.data?.items || []),
        ...(byRedo?.data?.items || []),
      ];
      const seen = new Set();
      const unique = [];
      for (const row of items) {
        const key = String(row.id || row._id);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
      }
      setRelatedRedos(unique);
    } catch {
      setRelatedRedos([]);
    }
  }, []);

  useEffect(() => {
    async function load() {
      if (!invoiceId) {
        setInvoice(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const [invRes, configRes, staffRes] = await Promise.all([
          preciousApi.getInvoice(invoiceId),
          preciousApi.getRedoConfig().catch(() => null),
          fetchStaffProfiles({ is_active: true }).catch(() => ({ data: [] })),
        ]);
        const data = invRes?.data || null;
        if (!data) throw new Error(invRes?.message || "Invoice not found");
        setInvoice(data);
        const days = Number(configRes?.data?.redo_window_days);
        if (Number.isFinite(days) && days > 0) setWindowDays(days);
        const staffRows = Array.isArray(staffRes?.data)
          ? staffRes.data
          : Array.isArray(staffRes?.data?.items)
            ? staffRes.data.items
            : [];
        setStaffList(staffRows);
        await loadRelatedRedos(invoiceId);
      } catch (err) {
        setInvoice(null);
        setError(err.response?.data?.message || err.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId, loadRelatedRedos]);

  const lineItems = invoice?.line_items || invoice?.lines || [];
  const serviceLines = lineItems.filter((line) => line.item_type === "service");
  const withinWindow = invoice
    ? isWithinRedoWindow(invoice.billing_date, windowDays)
    : false;

  return (
    <div className="page tax-list-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Request redo</h1>
          <p>
            Create a pending redo for a service line within the {windowDays}-day window.
            Approve and complete are separate steps.
          </p>
        </div>
        <div className="module-hero-actions">
          <Link to="/invoices" className="module-hero-btn">
            Invoices
          </Link>
          <Link to="/redo/approvals" className="module-hero-btn">
            Approvals
          </Link>
          <Link to="/redo/complete" className="module-hero-btn">
            Complete
          </Link>
        </div>
      </header>

      {notice ? <p className="user-success-text">{notice}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      {!invoiceId ? (
        <section className="status-card">
          <h2 className="redo-page-title">How to request</h2>
          <p className="page-note">
            Open a tax invoice and use <strong>Request Redo</strong> on a service line, or pass an
            invoice id in the URL.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link to="/invoices" className="user-primary-btn user-primary-btn--hero">
              Browse invoices
            </Link>
            <Link to="/billing" className="user-secondary-btn">
              POS billing
            </Link>
          </div>
          <p className="page-note" style={{ marginTop: "1rem" }}>
            Direct link pattern: <code>/redo/request?invoiceId=&lt;id&gt;</code>
          </p>
        </section>
      ) : null}

      {invoiceId && loading ? <p>Loading invoice…</p> : null}

      {invoice && !loading ? (
        <>
          <section className="user-summary-row">
            <div className="user-summary-card">
              <span className="user-summary-label">Invoice</span>
              <strong>
                <Link to={`/invoices/${invoice.id || invoiceId}`}>
                  {invoice.invoice_number || invoiceId}
                </Link>
              </strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Customer</span>
              <strong>{invoice.customer_name || "—"}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Redo window</span>
              <strong>{withinWindow ? "Open" : "Closed"}</strong>
            </div>
            <div className="user-summary-card">
              <span className="user-summary-label">Service lines</span>
              <strong>{serviceLines.length}</strong>
            </div>
          </section>

          {!canRequest ? (
            <p className="page-note">Requesting a redo requires billing edit permission.</p>
          ) : null}

          <section className="status-card user-table-card">
            {serviceLines.length === 0 ? (
              <p className="page-note">This invoice has no service lines.</p>
            ) : (
              <div className="user-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Staff</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceLines.map((line) => (
                      <tr key={String(line.id || line._id)}>
                        <td>
                          <strong>{line.item_name || "Service"}</strong>
                        </td>
                        <td>
                          {line.staff_name ||
                            (line.staff_id
                              ? `Staff #${String(line.staff_id).slice(-4)}`
                              : "—")}
                        </td>
                        <td>
                          <InvoiceLineRedoActions
                            line={line}
                            invoice={invoice}
                            relatedRedos={relatedRedos}
                            windowDays={windowDays}
                            canRequest={canRequest}
                            onRequestClick={setRedoFormLine}
                            isModal={false}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <InvoiceRedoRequestModal
        key={
          redoFormLine
            ? `${lineStaffId(redoFormLine)}-${String(redoFormLine.id || redoFormLine._id)}`
            : "closed"
        }
        open={Boolean(redoFormLine)}
        line={redoFormLine}
        staffList={staffList}
        defaultStaffId={redoFormLine ? lineStaffId(redoFormLine) : ""}
        onClose={() => setRedoFormLine(null)}
        onSubmitted={async () => {
          setNotice("Redo request submitted — pending approval.");
          setRedoFormLine(null);
          await loadRelatedRedos(invoiceId);
        }}
      />
    </div>
  );
}
