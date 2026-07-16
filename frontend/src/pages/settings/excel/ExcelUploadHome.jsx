import { useState } from "react";
import { Link } from "react-router-dom";
import "./ExcelUploadHome.css";

const UPLOAD_MODULES = [
  {
    key: "services",
    code: "SVC",
    badgeBg: "#eff6ff",
    badgeColor: "#2563eb",
    title: "Service Master",
    description: "Bulk import service categories, durations, prices, and commission overrides.",
    columns: "name, category, duration_min, price, tax_code, is_active",
    template: "services_template.xlsx",
  },
  {
    key: "products",
    code: "PRD",
    badgeBg: "#fdf4ff",
    badgeColor: "#c026d3",
    title: "Product Master",
    description: "Import retail SKUs, purchase/sale prices, stock levels, and reorder thresholds.",
    columns: "sku, name, unit, purchase_price, sale_price, current_stock, reorder_level",
    template: "products_template.xlsx",
  },
  {
    key: "tax",
    code: "GST",
    badgeBg: "#f0fdf4",
    badgeColor: "#16a34a",
    title: "Tax / GST Master",
    description: "Upload GST slabs and tax rules for services and retail products.",
    columns: "name, rate_percent, applies_to, is_active",
    template: "tax_template.xlsx",
  },
  {
    key: "staff",
    code: "STF",
    badgeBg: "#fff7ed",
    badgeColor: "#ea580c",
    title: "Staff Profiles",
    description: "Import staff designations, base salaries, shift assignments, and specializations.",
    columns: "name, phone, email, designation, base_salary, shift, commission_slab",
    template: "staff_template.xlsx",
  },
  {
    key: "customers",
    code: "CRM",
    badgeBg: "#ecfeff",
    badgeColor: "#0891b2",
    title: "Customer Master",
    description: "Bulk onboard clients with phone, DOB, tags, and preferred stylist mapping.",
    columns: "name, phone, gender, dob, tags, preferred_stylist",
    template: "customers_template.xlsx",
  },
  {
    key: "shifts",
    code: "SHF",
    badgeBg: "#f1f5f9",
    badgeColor: "#475569",
    title: "Shift Schedules",
    description: "Upload working shift rosters with start/end times for attendance rules.",
    columns: "name, start_time, end_time, branch, is_active",
    template: "shifts_template.xlsx",
  },
  {
    key: "packages",
    code: "PKG",
    badgeBg: "#fef2f2",
    badgeColor: "#e11d48",
    title: "Package Masters",
    description: "Import prepaid bundles, credit quotas, validity days, and membership tiers.",
    columns: "name, price, credits, validity_days, services_included",
    template: "packages_template.xlsx",
  },
  {
    key: "commission",
    code: "COM",
    badgeBg: "#fefce8",
    badgeColor: "#ca8a04",
    title: "Commission Slabs",
    description: "Define percentage, flat, tiered, or threshold-based commission rules for staff.",
    columns: "name, type, rules_json, is_active",
    template: "commission_slabs_template.xlsx",
  },
  {
    key: "users",
    code: "USR",
    badgeBg: "#eef2ff",
    badgeColor: "#4f46e5",
    title: "System Users",
    description: "Bulk invite users with roles, branches, and access permissions.",
    columns: "name, phone, email, role, branch, is_active",
    template: "users_template.xlsx",
  },
  {
    key: "inventory",
    code: "STK",
    badgeBg: "#f0fdfa",
    badgeColor: "#0f766e",
    title: "Opening Stock",
    description: "Set opening stock quantities and valuation for inventory go-live.",
    columns: "sku, opening_qty, batch_ref, as_of_date",
    template: "opening_stock_template.xlsx",
  },
];

export default function ExcelUploadHome() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const active = UPLOAD_MODULES.find((m) => m.key === selectedModule) || null;

  return (
    <div className="page excel-upload-page">
      <header className="page-header">
        <Link to="/settings" className="quick-nav-link" style={{ marginBottom: "0.5rem", display: "inline-block" }}>
          ← Back to Settings
        </Link>
        <p className="app-eyebrow">Bulk Data Import</p>
        <h1>Upload Excel</h1>
        {/* <p className="page-description">
          Prototype hub for importing salon master data via spreadsheet templates. Upload and parsing will be wired to the backend in a later phase.
        </p> */}
      </header>

      <section className="excel-upload-banner">
        {/* <div>
          <strong>Prototype mode</strong>
          <p>
            Download a template, fill rows, and preview the upload flow. Files are not sent to the server yet — this screen shows where each master import will live.
          </p>
        </div> */}
        {/* <span className="excel-upload-banner__pill">Coming soon</span> */}
      </section>

      <div className="excel-upload-layout">
        <section className="excel-upload-modules">
          <h2>Master data modules</h2>
          <p className="excel-upload-modules__hint">Select a module to see its upload panel</p>

          <div className="excel-upload-grid">
            {UPLOAD_MODULES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`excel-upload-card ${selectedModule === item.key ? "is-active" : ""}`}
                onClick={() => setSelectedModule(item.key)}
              >
                <div
                  className="excel-upload-card__badge"
                  style={{ background: item.badgeBg, color: item.badgeColor }}
                >
                  {item.code}
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="excel-upload-card__meta">{item.template}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="excel-upload-panel">
          {!active ? (
            <div className="excel-upload-panel__empty">
              <div className="excel-upload-panel__icon" aria-hidden="true">
                XLS
              </div>
              <strong>Select a module</strong>
              <p>Choose a master data card on the left to open its upload workspace.</p>
            </div>
          ) : (
            <>
              <div className="excel-upload-panel__header">
                <div
                  className="excel-upload-card__badge"
                  style={{ background: active.badgeBg, color: active.badgeColor }}
                >
                  {active.code}
                </div>
                <div>
                  <h2>{active.title}</h2>
                  <p>{active.description}</p>
                </div>
              </div>

              <div className="excel-upload-panel__actions">
                <button type="button" className="user-secondary-btn" disabled>
                  Download template
                </button>
                <button type="button" className="user-primary-btn" disabled style={{ opacity: 0.65 }}>
                  Upload & import
                </button>
              </div>

              <div
                className={`excel-upload-dropzone ${dragOver ? "is-dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
              >
                <div className="excel-upload-dropzone__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3v12M7 8l5-5 5 5M5 20h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <strong>Drop .xlsx / .csv here</strong>
                <p>Or click to browse — disabled in prototype</p>
                <input type="file" accept=".xlsx,.xls,.csv" disabled className="excel-upload-dropzone__input" />
              </div>

              <div className="excel-upload-panel__meta">
                <div>
                  <span>Template file</span>
                  <strong>{active.template}</strong>
                </div>
                <div>
                  <span>Expected columns</span>
                  <strong>{active.columns}</strong>
                </div>
              </div>

              <div className="excel-upload-preview">
                <div className="excel-upload-preview__header">
                  <strong>Import preview</strong>
                  <span>Dummy rows</span>
                </div>
                <div className="excel-upload-preview__table-wrap">
                  <table className="excel-upload-preview__table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Status</th>
                        <th>Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td><span className="excel-status-pill pending">Pending</span></td>
                        <td>Awaiting file upload…</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td><span className="excel-status-pill muted">—</span></td>
                        <td>Validation will run here</td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td><span className="excel-status-pill muted">—</span></td>
                        <td>Duplicate checks &amp; error report</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
