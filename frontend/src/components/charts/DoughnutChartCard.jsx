import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import ChartPanel from "./ChartPanel.jsx";
import "./chartConfig.js";
import { defaultChartOptions } from "./chartTheme.js";

const centerTotalPlugin = {
  id: "centerTotal",
  beforeDraw(chart) {
    const { ctx, chartArea } = chart;

    if (!chartArea) {
      return;
    }

    const values = chart.data.datasets[0]?.data || [];
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#102a43";
    ctx.font = '700 1.75rem Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(total.toLocaleString("en-IN"), centerX, centerY - 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = '600 0.68rem Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText("TOTAL", centerX, centerY + 14);
    ctx.restore();
  },
};

function buildLegendItems(labels, values, colors) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);

  return labels.map((label, index) => {
    const value = Number(values[index] || 0);
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return {
      label,
      value,
      percent,
      color: colors[index % colors.length],
    };
  });
}

export default function DoughnutChartCard({
  title,
  subtitle,
  labels,
  datasets,
  height = 280,
}) {
  const dataset = datasets[0] || { data: [], backgroundColor: [] };
  const values = dataset.data || [];
  const colors = Array.isArray(dataset.backgroundColor)
    ? dataset.backgroundColor
    : [];

  const legendItems = useMemo(
    () => buildLegendItems(labels, values, colors),
    [labels, values, colors]
  );

  const styledDatasets = datasets.map((entry) => ({
    ...entry,
    borderWidth: 3,
    borderColor: "#ffffff",
    hoverBorderColor: "#ffffff",
    hoverOffset: 8,
    spacing: 3,
  }));

  const data = { labels, datasets: styledDatasets };
  const options = {
    ...defaultChartOptions,
    cutout: "74%",
    layout: {
      padding: 4,
    },
    plugins: {
      ...defaultChartOptions.plugins,
      legend: {
        display: false,
      },
      tooltip: {
        ...defaultChartOptions.plugins.tooltip,
        callbacks: {
          label(context) {
            const value = Number(context.raw || 0);
            const total = context.dataset.data.reduce(
              (sum, item) => sum + Number(item || 0),
              0
            );
            const percent = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${context.label}: ${percent}% (${value.toLocaleString("en-IN")})`;
          },
        },
      },
    },
  };

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="doughnut-chart-layout" style={{ minHeight: height }}>
        <div className="doughnut-chart-layout__chart">
          <Doughnut
            data={data}
            options={options}
            plugins={[centerTotalPlugin]}
          />
        </div>

        <ul className="doughnut-chart-layout__legend">
          {legendItems.map((item) => (
            <li key={item.label} className="doughnut-chart-layout__legend-item">
              <span
                className="doughnut-chart-layout__legend-dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="doughnut-chart-layout__legend-label">{item.label}</span>
              <span className="doughnut-chart-layout__legend-value">
                {item.percent}% ({item.value.toLocaleString("en-IN")})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartPanel>
  );
}
