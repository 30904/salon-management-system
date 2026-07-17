import { useEffect, useState } from "react";
import { reportsApi } from "../api/index.js";
import { formatInr } from "../utils/format.js";

export default function ReportsLite() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    reportsApi
      .getOwnerReports()
      .then((res) => {
        if (!res.success) throw new Error(res.message || "Failed to load reports");
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-pad">
      <h1>Reports — {data?.period?.label || "This month"}</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && data && (
        <div className="stat-grid">
          <div className="stat-tile">
            <p className="card-label">Revenue</p>
            <strong>{formatInr(data.executive.revenue.value)}</strong>
          </div>
          <div className="stat-tile">
            <p className="card-label">Invoices</p>
            <strong>{data.executive.invoices.count}</strong>
          </div>
          <div className="stat-tile">
            <p className="card-label">Avg ticket</p>
            <strong>{formatInr(data.executive.avg_ticket.value)}</strong>
          </div>
          <div className="stat-tile">
            <p className="card-label">Outstanding</p>
            <strong>{formatInr(data.executive.outstanding)}</strong>
          </div>
          <div className="stat-tile">
            <p className="card-label">Bookings</p>
            <strong>{data.kpis.find((k) => k.key === "bookings")?.value ?? "—"}</strong>
          </div>
          <div className="stat-tile">
            <p className="card-label">Top staff</p>
            <strong>{data.staff_leaderboard?.[0]?.name || "—"}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
