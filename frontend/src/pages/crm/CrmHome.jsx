import { useEffect, useMemo, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

function formatPhone(phone) {
  return phone ? String(phone) : "—";
}

export default function CrmHome() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("crm", "view");
  const canCreate = hasPermission("crm", "create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);

  const [search, setSearch] = useState("");

  const loadCustomers = async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await arnavApi.listCustomers({
        search: query?.trim() || undefined,
        limit: 50,
      });
      if (!res.success) throw new Error(res.message || "Failed to load customers");
      setCustomers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(term) || phone.includes(term);
    });
  }, [customers, search]);

  if (!canView) {
    return (
      <div className="page access-denied-page">
        <div className="access-denied-card">
          <h1>Access denied</h1>
          <p className="page-note">You don’t have permission to view CRM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">CRM</p>
          <h1>Customers</h1>
          <p className="page-description">
            Prototype customer list pulled from backend customers endpoints.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="user-primary-btn"
            onClick={async () => {
              const name = window.prompt("Customer name?");
              if (!name?.trim()) return;
              const phone = window.prompt("Customer phone?");
              if (!phone?.trim()) return;

              try {
                const res = await arnavApi.findOrCreateCustomer({ name, phone });
                if (!res.success) throw new Error(res.message || "Create failed");
                await loadCustomers(search);
              } catch (err) {
                // eslint-disable-next-line no-alert
                alert(err.response?.data?.message || err.message || "Create failed");
              }
            }}
          >
            + Add customer
          </button>
        )}
      </header>

      <div className="user-permissions-toolbar" style={{ marginBottom: "1rem" }}>
        <div className="user-permissions-filter">
          <strong style={{ color: "#111827" }}>Search</strong>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "0.55rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              width: 320,
            }}
          />
          <button
            type="button"
            className="user-secondary-btn"
            style={{ padding: "0.55rem 0.85rem" }}
            onClick={() => loadCustomers(search)}
          >
            Search
          </button>
          <button
            type="button"
            className="user-secondary-btn"
            style={{ padding: "0.55rem 0.85rem" }}
            onClick={() => {
              setSearch("");
              loadCustomers("");
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {loading && <p>Loading customers…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && (
        <section className="status-card user-table-card">
          {filteredCustomers.length === 0 ? (
            <p className="page-note">No customers found.</p>
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Gender</th>
                    <th>Tags</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id || c._id}>
                      <td>
                        <div className="user-name-cell">
                          <strong>{c.name || "—"}</strong>
                        </div>
                      </td>
                      <td>{formatPhone(c.phone)}</td>
                      <td>{c.gender || "—"}</td>
                      <td>
                        {c.tags?.length ? (
                          <span style={{ color: "#64748b" }}>
                            {c.tags.map((t) => t.label).join(", ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ maxWidth: 340 }}>
                        <span style={{ color: "#475569" }}>{c.notes || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
