import { useEffect, useState } from "react";
import {
  BarChartCard,
  DoughnutChartCard,
  LineChartCard,
  chartColors,
  chartPalette,
} from "./components/charts";
import "./App.css";

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

function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-eyebrow">S21 Management System</p>
        <h1>Phase 0 — Technology Stack</h1>
        <p className="app-subtitle">
          Row 8 complete: Chart.js wrappers ready for dashboard reuse.
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

export default App;
