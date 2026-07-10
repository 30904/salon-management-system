import { Line } from "react-chartjs-2";
import "./chartConfig.js";
import { defaultChartOptions } from "./chartTheme.js";

export default function LineChartCard({ title, labels, datasets, height = 280 }) {
  const data = { labels, datasets };
  const options = {
    ...defaultChartOptions,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: Boolean(title),
        text: title,
        align: "start",
        font: { size: 14, weight: "600" },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
    },
  };

  return (
    <div className="chart-card" style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
