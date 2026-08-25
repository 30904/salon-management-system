import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { arnavApi } from "../../api";
import "./CrmHome.css";

const THRESHOLD_OPTIONS = [30, 45, 60, 90];
const SEARCH_DEBOUNCE_MS = 300;

function formatVisitDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDaysSince(value) {
  if (value === null || value === undefined) return "Never visited";
  return `${value} day${value === 1 ? "" : "s"}`;
}

/**
 * Inactive-visit CRM list — paginated like CrmHome (never hydrate full inactive set).
 * Desktop only (no mobile inactive screen).
 */
export default function CrmInactiveCustomers() {
  const [thresholdDays, setThresholdDays] = useState(60);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchInactivePage = useCallback(
    async ({ days, query = "", nextPage = 1, append = false }) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await arnavApi.getInactiveCustomers({
          thresholdDays: days,
          search: query?.trim() || undefined,
          page: nextPage,
        });
        if (!res?.success) {
          throw new Error(res?.message || "Failed to load inactive customers");
        }

        const payload = res.data || {};
        const items = Array.isArray(payload.items) ? payload.items : [];

        setCustomers((prev) => (append ? [...prev, ...items] : items));
        setPage(Number(payload.page) || nextPage);
        setHasMore(Boolean(payload.hasMore));
        setTotal(Number(payload.total) || (append ? total : items.length));

        if (!append) {
          setAppliedSearch(query?.trim() || "");
        }
      } catch (err) {
        const message =
          err.response?.data?.message || err.message || "Failed to load inactive customers";
        if (append) {
          // eslint-disable-next-line no-alert
          alert(message);
        } else {
          setError(message);
          setCustomers([]);
          setPage(1);
          setHasMore(false);
          setTotal(0);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [total]
  );

  const loadInactive = useCallback(
    (query = "") =>
      fetchInactivePage({ days: thresholdDays, query, nextPage: 1, append: false }),
    [fetchInactivePage, thresholdDays]
  );

  function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    fetchInactivePage({
      days: thresholdDays,
      query: appliedSearch,
      nextPage: page + 1,
      append: true,
    });
  }

  function handleClearSearch() {
    setSearch("");
    if (appliedSearch !== "") {
      loadInactive("");
    }
  }

  function handleSearchNow() {
    loadInactive(search);
  }

  useEffect(() => {
    loadInactive("");
  }, [thresholdDays, loadInactive]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === appliedSearch) return undefined;

    const timer = window.setTimeout(() => {
      loadInactive(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search, appliedSearch, loadInactive]);

  const rows = useMemo(() => customers, [customers]);

  return (
    <div className="crm-inactive-customers">
      <section className="crm-toolbar">
        <label className="crm-search">
          Search inactive customers
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchNow();
            }}
          />
        </label>
        <div className="crm-filter-row" role="group" aria-label="Inactive threshold">
          <span className="crm-filter-row__label">Inactive for</span>
          {THRESHOLD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              className={`user-filter-btn ${thresholdDays === days ? "active" : ""}`}
              onClick={() => setThresholdDays(days)}
            >
              {days} days
            </button>
          ))}
        </div>
        <div className="crm-toolbar-actions">
          <button type="button" className="crm-btn crm-btn--secondary" onClick={handleSearchNow}>
            Search
          </button>
          <button type="button" className="crm-btn crm-btn--secondary" onClick={handleClearSearch}>
            Clear
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--secondary"
            onClick={() => loadInactive(appliedSearch)}
          >
            Refresh
          </button>
        </div>
      </section>

      {loading && <p>Loading inactive customers…</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && (
        <section className="crm-table-card status-card">
          <div className="crm-table-toolbar">
            <strong>
              Inactive customers = {total}
              {appliedSearch ? ` — showing ${rows.length} loaded` : rows.length < total ? ` — showing ${rows.length} of ${total}` : ""}
            </strong>
            <span>No visit within the last {thresholdDays} days (or never visited)</span>
          </div>

          {rows.length === 0 ? (
            <p className="page-note">No inactive customers for this threshold.</p>
          ) : (
            <>
              <div className="crm-table-wrap">
                <table className="crm-table user-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Last Visit</th>
                      <th>Days Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id || row._id || row.phone}>
                        <td>
                          <strong>{row.name || "—"}</strong>
                        </td>
                        <td>{row.phone || "—"}</td>
                        <td>{formatVisitDate(row.effective_last_visit)}</td>
                        <td>{formatDaysSince(row.days_since_last_visit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore ? (
                <div className="crm-toolbar-actions" style={{ marginTop: "0.85rem" }}>
                  <button
                    type="button"
                    className="crm-btn crm-btn--secondary"
                    onClick={handleLoadMore}
                    disabled={loadingMore || !hasMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Standalone route page (/crm/inactive) — crm:view */
export function CrmInactiveCustomersPage() {
  return (
    <div className="page crm-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Inactive Customers</h1>
          <p>Customers with no recent salon visit — adjust the day threshold to re-query.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/crm" className="module-hero-btn">
            Back to CRM
          </Link>
        </div>
      </header>
      <CrmInactiveCustomers />
    </div>
  );
}
