import { Bar } from "react-chartjs-2";
import ChartPanel from "./ChartPanel.jsx";
import "./chartConfig.js";
import {
  barGlowPlugin,
  barTrackPlugin,
  barValueLabelPlugin,
  createBarGradient,
} from "./barChartPlugins.js";
import {
  axisGridColor,
  axisTickColor,
  defaultChartOptions,
} from "./chartTheme.js";

function getSuggestedMax(values = []) {
  const max = Math.max(...values.map((value) => Number(value) || 0), 0);
  return max > 0 ? Math.ceil(max * 1.22) : 10;
}

export default function BarChartCard({
  title,
  subtitle,
  labels,
  datasets,
  height = 300,
}) {
  const primaryDataset = datasets[0] || { data: [] };
  const values = primaryDataset.data || [];
  const suggestedMax = getSuggestedMax(values);

  const styledDatasets = datasets.map((dataset) => ({
    label: dataset.label || "Count",
    borderRadius: {
      topLeft: 12,
      topRight: 12,
      bottomLeft: 6,
      bottomRight: 6,
    },
    borderSkipped: false,
    maxBarThickness: 58,
    barPercentage: 0.72,
    categoryPercentage: 0.74,
    ...dataset,
    backgroundColor: (context) =>
      createBarGradient(context.chart, context.dataIndex),
    hoverBackgroundColor: (context) =>
      createBarGradient(context.chart, context.dataIndex, { hover: true }),
  }));

  const data = { labels, datasets: styledDatasets };
  const options = {
    ...defaultChartOptions,
    animation: {
      duration: 700,
      easing: "easeOutQuart",
    },
    plugins: {
      ...defaultChartOptions.plugins,
      legend: {
        ...defaultChartOptions.plugins.legend,
        display: false,
      },
      tooltip: {
        ...defaultChartOptions.plugins.tooltip,
        callbacks: {
          label(context) {
            const value = Number(context.raw || 0);
            return `${value.toLocaleString("en-IN")} bookings`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: axisTickColor,
          font: { size: 11, weight: "600" },
          maxRotation: 0,
          autoSkip: false,
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax,
        border: { display: false },
        grid: {
          color: axisGridColor,
          drawTicks: false,
        },
        ticks: {
          color: axisTickColor,
          font: { size: 11, weight: "500" },
          padding: 8,
          stepSize: suggestedMax > 20 ? 10 : 5,
        },
      },
    },
  };

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="chart-panel__canvas chart-panel__canvas--bar" style={{ height }}>
        <Bar
          data={data}
          options={options}
          plugins={[barTrackPlugin, barGlowPlugin, barValueLabelPlugin]}
        />
      </div>
    </ChartPanel>
  );
}
