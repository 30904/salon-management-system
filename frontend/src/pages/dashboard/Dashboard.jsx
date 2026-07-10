import { useEffect, useState } from "react";
import { arnavApi } from "../../api";
import {
  BarChartCard,
  DoughnutChartCard,
  LineChartCard,
  chartColors,
  chartPalette,
} from "../../components/charts";

const sampleRevenue = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "Revenue (₹)",
      data: [12000, 15000, 11000, 18000, 22000, 28000, 16000],
      borderColor: chartColors.primary,
      backgroundColor: "rgba(79, 70, 229, 0.15)",
      fill: true,
      tension: 0.35,
    },
  ],
};

const sampleServices = {
  labels: ["Hair", "Skin", "Spa", "Bridal", "Retail"],
  datasets: [
    {
      label: "Bookings",
      data: [42, 28, 35, 12, 18],
      backgroundColor: chartPalette,
      borderRadius: 6,
    },
  ],
};

const sampleSplit = {
  labels: ["Services", "Products"],
  datasets: [
    {
      data: [72, 28],
      backgroundColor: [chartColors.primary, chartColors.secondary],
      borderWidth: 0,
    },
  ],
};

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    arnavApi
      .getHealth()
      .then((data) => setHealth(data))
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <p className="app-eyebrow">Dashboard</p>
        <h1>Today at a glance</h1>
        <p className="page-description">
          Executive cockpit — full KPIs and charts come in Phase 2.
        </p>
      </header>

      <section className="status-card">
        <h2>API health check</h2>
        {error && <p className="status-error">Error: {error}</p>}
        {!error && !health && <p>Checking backend…</p>}
        {health && (
          <div className="status-body">
            <p className={`status-pill ${health.success ? "ok" : "warn"}`}>
              {health.success ? "Connected" : "Check database"}
            </p>
            <pre>{JSON.stringify(health, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="charts-section">
        <h2>Chart wrappers (sample data)</h2>
        <div className="charts-grid">
          <LineChartCard
            title="Revenue trend"
            labels={sampleRevenue.labels}
            datasets={sampleRevenue.datasets}
          />
          <BarChartCard
            title="Service category split"
            labels={sampleServices.labels}
            datasets={sampleServices.datasets}
          />
          <DoughnutChartCard
            title="Services vs products"
            labels={sampleSplit.labels}
            datasets={sampleSplit.datasets}
          />
        </div>
      </section>
    </div>
  );
}
