import { useEffect, useMemo, useState } from "react";
import { preciousApi } from "../../api";
import { openPackageBalanceWhatsApp } from "../../utils/whatsappPackage.js";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function isPackageExpired(pkg) {
  if (!pkg) return false;
  if (pkg.status === "expired") return true;
  if (!pkg.expiry_date) return false;
  return new Date(pkg.expiry_date).getTime() < Date.now();
}

function isActiveWithCredits(pkg) {
  if (!pkg) return false;
  if (pkg.status === "cancelled" || pkg.status === "exhausted") return false;
  if (isPackageExpired(pkg)) return false;
  return Number(pkg.credits_remaining || 0) > 0;
}

export default function CrmPendingCredits() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  async function loadPackages() {
    setLoading(true);
    setError(null);
    try {
      const res = await preciousApi.listCustomerPackages();
      const list = res?.data || (Array.isArray(res) ? res : []);
      setPackages(list);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load package credits");
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  const customerRows = useMemo(() => {
    const map = new Map();

    packages.forEach((pkg) => {
      if (!isActiveWithCredits(pkg)) return;

      const cust = pkg.customer || pkg.customer_id;
      const custId = String(cust?.id || cust?._id || cust || "unknown");
      const master = pkg.package_master || pkg.package_master_id || {};
      const remaining = Number(pkg.credits_remaining || 0);
      const total = Number(master.credit_count || 0);

      if (!map.has(custId)) {
        map.set(custId, {
          id: custId,
          name: cust?.name || "Unknown Customer",
          phone: cust?.phone || null,
          remainingCredits: 0,
          activePlans: 0,
          packages: [],
        });
      }

      const row = map.get(custId);
      row.remainingCredits += remaining;
      row.activePlans += 1;
      row.packages.push({
        id: pkg.id || pkg._id,
        name: master.name || "Package",
        remaining,
        total,
        used: Math.max(0, total - remaining),
        expiry_date: pkg.expiry_date,
        purchase_date: pkg.purchase_date,
      });
    });

    let list = Array.from(map.values()).sort(
      (a, b) => b.remainingCredits - a.remainingCredits
    );

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          String(row.phone || "").includes(q)
      );
    }

    return list;
  }, [packages, search]);

  const selectedCustomer = useMemo(
    () => customerRows.find((row) => row.id === selectedCustomerId) || null,
    [customerRows, selectedCustomerId]
  );

  return (
    <div className="crm-pending-credits">
      <section className="crm-toolbar">
        <label className="crm-search">
          Search customers with pending credits
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="crm-toolbar-actions">
          <button type="button" className="crm-btn crm-btn--secondary" onClick={loadPackages}>
            Refresh
          </button>
          {selectedCustomer && (
            <button
              type="button"
              className="crm-btn crm-btn--secondary"
              onClick={() => setSelectedCustomerId(null)}
            >
              Back to all
            </button>
          )}
        </div>
      </section>

      {loading && <p>Loading pending package credits…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && !selectedCustomer && (
        <section className="crm-table-card">
          <div className="crm-table-toolbar">
            <strong>
              Customers with pending credits = {customerRows.length}
            </strong>
            <span>Total remaining across salon shown per customer</span>
          </div>

          {customerRows.length === 0 ? (
            <p className="page-note">No customers currently have pending package credits.</p>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Active packages</th>
                    <th>Remaining credits</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.phone || "—"}</td>
                      <td>{row.activePlans}</td>
                      <td>
                        <strong className="crm-pending-credits__remaining">
                          {row.remainingCredits}
                        </strong>
                      </td>
                      <td>
                        <div className="crm-row-actions">
                          <button
                            type="button"
                            className="crm-btn crm-btn--secondary crm-btn--small"
                            onClick={() => setSelectedCustomerId(row.id)}
                          >
                            View packages
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && !error && selectedCustomer && (
        <section className="crm-table-card">
          <div className="crm-table-toolbar">
            <strong>
              {selectedCustomer.name} — pending packages ({selectedCustomer.packages.length})
            </strong>
            <span>
              Total remaining = {selectedCustomer.remainingCredits} credit(s)
            </span>
          </div>

          <div className="crm-pending-credits__grid">
            {selectedCustomer.packages.map((pkg) => (
              <article key={pkg.id} className="crm-pending-credits__card">
                <div className="crm-pending-credits__card-top">
                  <h3>{pkg.name}</h3>
                  <span className="crm-tag">Active</span>
                </div>

                <div className="crm-pending-credits__stats">
                  <div>
                    <span>Remaining</span>
                    <strong>
                      {pkg.remaining}
                      {pkg.total ? ` / ${pkg.total}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span>Used</span>
                    <strong>{pkg.used}</strong>
                  </div>
                </div>

                <div className="crm-pending-credits__meta">
                  <span>Purchased: {formatDate(pkg.purchase_date)}</span>
                  <span>Valid until: {formatDate(pkg.expiry_date)}</span>
                </div>

                {selectedCustomer.phone && (
                  <button
                    type="button"
                    className="crm-btn crm-btn--secondary"
                    onClick={() =>
                      openPackageBalanceWhatsApp({
                        customerName: selectedCustomer.name,
                        customerPhone: selectedCustomer.phone,
                        packageName: pkg.name,
                        creditsRemaining: pkg.remaining,
                        creditsTotal: pkg.total,
                      })
                    }
                  >
                    WhatsApp balance
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
