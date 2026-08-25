import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { preciousApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Feature 4 — pending redo approvals (payroll.edit).
 */
export default function RedoApprovals() {
  const { hasPermission } = usePermission();
  const canDecide = hasPermission("payroll", "edit");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await preciousApi.listRedoRequests({
        status: "pending_approval",
        limit: 100,
      });
      if (!res?.success && !res?.data) {
        throw new Error(res?.message || "Failed to load pending redo requests");
      }
      setItems(res.data?.items || []);
    } catch (err) {
      setItems([]);
      setError(
        err.response?.data?.message || err.message || "Failed to load pending redo requests"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function decide(row, action) {
    if (!canDecide) return;
    setNotice("");
    setError("");
    setBusyId(String(row.id));
    try {
      const res =
        action === "approve"
          ? await preciousApi.approveRedoRequest(row.id)
          : await preciousApi.rejectRedoRequest(row.id);
      if (!res?.success && !res?.data) {
        throw new Error(res?.message || `Failed to ${action} redo request`);
      }
      const who = row.customer_name || row.service_name || "request";
      setNotice(
        action === "approve"
          ? `Approved redo for ${who}. Open Complete redo to record the visit.`
          : `Rejected redo for ${who}.`
      );
      await loadPending();
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to ${action} redo`);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="page tax-list-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Redo approvals</h1>
          <p>Review pending service redo requests. Approve to allow a free redo visit.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/redo/request" className="module-hero-btn">
            Request redo
          </Link>
          <Link to="/redo/complete" className="module-hero-btn">
            Complete redo
          </Link>
          <Link to="/payroll" className="module-hero-btn">
            Back to payroll
          </Link>
          <button
            type="button"
            className="module-hero-btn"
            onClick={loadPending}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {notice ? <p className="user-success-text">{notice}</p> : null}
      {error ? <p className="status-error">{error}</p> : null}

      {!canDecide ? (
        <p className="page-note">
          You can view this queue, but Approve / Reject requires payroll edit permission.
        </p>
      ) : null}

      <section className="user-summary-row">
        <div className="user-summary-card">
          <span className="user-summary-label">Pending</span>
          <strong>{loading ? "…" : items.length}</strong>
        </div>
        <div className="user-summary-card">
          <span className="user-summary-label">Next step after approve</span>
          <strong>Complete redo visit</strong>
        </div>
      </section>

      <section className="status-card user-table-card">
        {loading ? <p>Loading pending redo requests…</p> : null}

        {!loading && items.length === 0 ? (
          <p className="page-note">No pending redo requests.</p>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Original invoice</th>
                  <th>Original staff</th>
                  <th>Redo staff</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row.id);
                  const busy = busyId === id;
                  return (
                    <tr key={id}>
                      <td>{formatWhen(row.created_at)}</td>
                      <td>
                        <strong>{row.customer_name || "—"}</strong>
                      </td>
                      <td>{row.service_name || "Service"}</td>
                      <td>
                        {row.original_invoice_id ? (
                          <Link to={`/invoices/${row.original_invoice_id}`}>
                            {row.invoice_number || "Invoice"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div>{row.original_staff_name || "—"}</div>
                        {row.original_staff_designation ? (
                          <small className="redo-meta-text">
                            {row.original_staff_designation}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <div>{row.redo_staff_name || "—"}</div>
                        {row.redo_staff_designation ? (
                          <small className="redo-meta-text">{row.redo_staff_designation}</small>
                        ) : null}
                      </td>
                      <td>{row.reason || "—"}</td>
                      <td>
                        <div className="redo-row-actions">
                          <button
                            type="button"
                            className="user-primary-btn user-primary-btn--hero"
                            disabled={!canDecide || busy}
                            onClick={() => decide(row, "approve")}
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="user-secondary-btn"
                            disabled={!canDecide || busy}
                            onClick={() => decide(row, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
