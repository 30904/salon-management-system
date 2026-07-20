import { useEffect, useState } from "react";
import { reportsApi } from "../api/index.js";
import { formatInr } from "../utils/format.js";

export default function Team() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await reportsApi.getTeamToday();
        if (!res.success) throw new Error(res.message || "Failed to load team sales");
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-pad">
      <h1>Team sales today</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="stat-row">
            <div className="stat-tile">
              <p className="card-label">Salon sales today</p>
              <strong>{formatInr(data.salon_total_sales_today)}</strong>
            </div>
            <div className="stat-tile">
              <p className="card-label">Salon commission today</p>
              <strong>{formatInr(data.salon_total_commission_today)}</strong>
            </div>
          </section>

          <ul className="entry-list">
            {data.team.map((member) => (
              <li key={member.staff_id} className="entry-card">
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">{member.designation}</p>
                </div>
                <div className="entry-amounts">
                  <span>{member.services_today} services</span>
                  <strong>{formatInr(member.sales_today)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
