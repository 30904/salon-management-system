import { useState } from "react";
import { Link } from "react-router-dom";
import { preciousApi } from "../../api";

export function isWithinRedoWindow(billingDate, windowDays = 7) {
  if (!billingDate) return false;
  const billed = new Date(billingDate).getTime();
  if (!Number.isFinite(billed)) return false;
  const windowMs = Number(windowDays) * 24 * 60 * 60 * 1000;
  return Date.now() - billed <= windowMs;
}

export function lineStaffId(line) {
  if (!line?.staff_id) return "";
  if (typeof line.staff_id === "object") {
    return String(line.staff_id.id || line.staff_id._id || "");
  }
  return String(line.staff_id);
}

export function lineId(line) {
  return String(line?.id || line?._id || "");
}

export function findRedoForOriginalLine(relatedRedos, line) {
  const id = lineId(line);
  if (!id) return null;
  return (
    relatedRedos.find(
      (r) =>
        String(r.original_line_item_id) === id &&
        r.status !== "rejected"
    ) || null
  );
}

export function findRedoForRedoInvoice(relatedRedos, invoiceId) {
  return (
    relatedRedos.find((r) => String(r.redo_invoice_id) === String(invoiceId)) ||
    null
  );
}

export function staffOptionLabel(staff) {
  const name =
    staff?.user?.name ||
    staff?.user_id?.name ||
    staff?.name ||
    staff?.full_name ||
    "Staff";
  const designation = staff?.designation ? ` · ${staff.designation}` : "";
  return `${name}${designation}`;
}

/**
 * Inline redo actions for one invoice line + request modal trigger.
 */
export function InvoiceLineRedoActions({
  line,
  invoice,
  relatedRedos,
  windowDays,
  canRequest,
  onRequestClick,
  isModal,
}) {
  if (!line || line.item_type !== "service") return null;

  const existing = findRedoForOriginalLine(relatedRedos, line);
  const isRedoLine = Boolean(line.redo_request_id);
  const fromRedo = findRedoForRedoInvoice(relatedRedos, invoice?.id || invoice?._id);
  const withinWindow = isWithinRedoWindow(invoice?.billing_date, windowDays);
  const voided = invoice?.payment_status === "void";

  if (isRedoLine || fromRedo) {
    const originalId =
      fromRedo?.original_invoice_id ||
      relatedRedos.find((r) => String(r.id) === String(line.redo_request_id))
        ?.original_invoice_id;
    if (!originalId) {
      return <span className="redo-status-chip">Redo visit (no charge)</span>;
    }
    return (
      <span className="redo-row-actions">
        <span className="redo-status-chip">Redo visit</span>
        {isModal ? (
          <span className="redo-meta-text">of original invoice</span>
        ) : (
          <Link to={`/invoices/${originalId}`} className="redo-status-link no-print">
            ← Original invoice
          </Link>
        )}
      </span>
    );
  }

  if (existing) {
    const statusLabel = String(existing.status || "").replaceAll("_", " ");
    return (
      <span className="redo-row-actions">
        <span className="redo-status-chip redo-status-chip--pending">
          Redo {statusLabel}
        </span>
        {existing.redo_invoice_id && !isModal ? (
          <Link
            to={`/invoices/${existing.redo_invoice_id}`}
            className="redo-status-link no-print"
          >
            Redo invoice →
          </Link>
        ) : null}
      </span>
    );
  }

  if (voided || !withinWindow || !canRequest) return null;

  return (
    <button
      type="button"
      className="user-secondary-btn redo-request-btn no-print"
      onClick={() => onRequestClick(line)}
    >
      Request Redo
    </button>
  );
}

export function InvoiceRedoRequestModal({
  open,
  line,
  staffList,
  defaultStaffId,
  onClose,
  onSubmitted,
}) {
  const [reason, setReason] = useState("");
  const [redoStaffId, setRedoStaffId] = useState(defaultStaffId || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open || !line) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await preciousApi.createRedoRequest({
        original_line_item_id: lineId(line),
        redo_staff_id: redoStaffId || defaultStaffId || undefined,
        reason: reason.trim(),
      });
      if (!res?.success && !res?.data) {
        throw new Error(res?.message || "Failed to create redo request");
      }
      onSubmitted?.(res.data);
      setReason("");
      onClose?.();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to create redo request"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pos-modal-backdrop no-print" style={{ zIndex: 100000 }} onClick={onClose}>
      <div
        className="pos-modal"
        style={{ maxWidth: "480px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pos-modal-header redo-modal-header">
          <h3>Request service redo</h3>
          <button type="button" className="pos-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pos-modal-body">
            <p className="page-note" style={{ marginTop: 0 }}>
              Redo for <strong>{line.item_name}</strong>. Customer is not charged; product cost
              (if any) is recorded at completion for payroll.
            </p>
            {error ? (
              <div className="status-error" style={{ marginBottom: "1rem" }}>
                {error}
              </div>
            ) : null}
            <div className="inventory-form-group" style={{ marginBottom: "0.85rem" }}>
              <label>Redo staff</label>
              <select
                value={redoStaffId || defaultStaffId || ""}
                onChange={(e) => setRedoStaffId(e.target.value)}
              >
                {staffList.map((st) => {
                  const id = String(st.id || st._id);
                  return (
                    <option key={id} value={id}>
                      {staffOptionLabel(st)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="inventory-form-group" style={{ margin: 0 }}>
              <label>Reason</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer not satisfied with color result"
              />
            </div>
          </div>
          <div className="pos-modal-footer">
            <button type="button" className="user-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="user-primary-btn user-primary-btn--hero"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit redo request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
