import { Line } from "react-chartjs-2";
import ChartPanel from "./ChartPanel.jsx";
import "./chartConfig.js";
import {
  axisGridColor,
  axisTickColor,
  chartColors,
  defaultChartOptions,
} from "./chartTheme.js";

export default function LineChartCard({
  title,
  subtitle,
  labels,
  datasets,
  height = 300,
}) {
  const styledDatasets = datasets.map((dataset) => ({
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBorderWidth: 2,
    pointBackgroundColor: "#ffffff",
    pointBorderColor: dataset.borderColor || chartColors.primary,
    borderWidth: 2.5,
    ...dataset,
  }));

  const data = { labels, datasets: styledDatasets };
  const options = {
    ...defaultChartOptions,
    plugins: {
      ...defaultChartOptions.plugins,
      legend: {
        ...defaultChartOptions.plugins.legend,
        display: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: axisTickColor,
          font: { size: 11, weight: "600" },
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: {
          color: axisGridColor,
          drawTicks: false,
        },
        ticks: {
          color: axisTickColor,
          font: { size: 11, weight: "500" },
          padding: 8,
        },
      },
    },
  };

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="chart-panel__canvas" style={{ height }}>
        <Line data={data} options={options} />
      </div>
    </ChartPanel>
  );
}
