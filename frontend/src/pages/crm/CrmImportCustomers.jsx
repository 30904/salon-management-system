import { useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";
import "./CrmHome.css";

export default function CrmImportCustomers() {
  const { hasPermission } = usePermission();
  const canImport = hasPermission("crm", "edit");

  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [batch, setBatch] = useState(null);

  function onFilePicked(nextFile) {
    setError(null);
    setBatch(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const name = String(nextFile.name || "").toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setError("Please choose a .csv or .xlsx file.");
      setFile(null);
      return;
    }
    setFile(nextFile);
  }

  async function handleImport() {
    if (!canImport) {
      setError("You do not have permission to import customers.");
      return;
    }
    if (!file) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }

    setBusy(true);
    setError(null);
    setBatch(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await arnavApi.importCustomers(formData);
      if (!res?.success) {
        throw new Error(res?.message || "Import failed");
      }
      setBatch(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canImport) {
    return (
      <div className="page access-denied-page">
        <div className="access-denied-card">
          <h1>Access denied</h1>
          <p className="page-note">You need CRM edit permission to import customers.</p>
          <Link to="/crm" className="module-hero-btn">
            Back to CRM
          </Link>
        </div>
      </div>
    );
  }

  const errorRows = Array.isArray(batch?.error_rows) ? batch.error_rows : [];

  return (
    <div className="page crm-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Import Customers</h1>
          <p>
            Upload a CSV or XLSX to create or merge salon customers by phone. Extra mobiles,
            email, and address are stored in notes.
          </p>
        </div>
        <div className="module-hero-actions">
          <Link to="/crm" className="module-hero-btn">
            Back to CRM
          </Link>
        </div>
      </header>

      {error ? <p className="status-error">{error}</p> : null}

      <section className="module-panel status-card">
        <div
          className={`crm-import-dropzone ${dragOver ? "is-dragover" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFilePicked(e.dataTransfer.files?.[0] || null);
          }}
        >
          <strong>Drop .xlsx / .csv here</strong>
          <p className="page-note">
            Or choose a file — no preview step; import runs immediately on submit.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
          />
          {file ? (
            <p className="page-note crm-import-dropzone__file">
              Selected: <strong>{file.name}</strong>
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="crm-btn crm-btn--primary"
          onClick={handleImport}
          disabled={busy || !file}
        >
          {busy ? "Importing…" : "Upload & import"}
        </button>
      </section>

      {batch ? (
        <>
          <section className="user-summary-row">
            <div className="user-summary-card status-card">
              <span className="user-summary-label">Created</span>
              <strong>{batch.created_count ?? 0}</strong>
            </div>
            <div className="user-summary-card status-card">
              <span className="user-summary-label">Merged</span>
              <strong>{batch.merged_count ?? 0}</strong>
            </div>
            <div className="user-summary-card status-card">
              <span className="user-summary-label">Skipped</span>
              <strong>{batch.skipped_count ?? 0}</strong>
            </div>
            <div className="user-summary-card status-card">
              <span className="user-summary-label">Total rows</span>
              <strong>{batch.total_rows ?? 0}</strong>
            </div>
          </section>

          <section className="crm-table-card status-card">
            <div className="crm-table-toolbar">
              <strong>Status: {batch.status || "—"}</strong>
              <span>{batch.file_name || "Import batch"}</span>
            </div>

            {errorRows.length === 0 ? (
              <p className="page-note">No error rows.</p>
            ) : (
              <div className="crm-table-wrap">
                <table className="crm-table user-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((row, idx) => (
                      <tr key={`${row.row ?? "x"}-${idx}`}>
                        <td>{row.row ?? "—"}</td>
                        <td>{row.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
