export const chartColors = {
  primary: "#0f766e",
  secondary: "#14b8a6",
  info: "#0284c7",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  muted: "#94a3b8",
};

export const chartPalette = [
  "#14b8a6",
  "#0f766e",
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
];

export const doughnutPalette = [
  chartColors.primary,
  chartColors.info,
  chartColors.warning,
];

const baseFont = {
  family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      align: "start",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 18,
        color: "#627d98",
        font: {
          ...baseFont,
          size: 12,
          weight: "600",
        },
      },
    },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      titleFont: { ...baseFont, size: 12, weight: "700" },
      bodyFont: { ...baseFont, size: 12, weight: "500" },
    },
  },
};

export const axisGridColor = "rgba(148, 163, 184, 0.18)";
export const axisTickColor = "#94a3b8";
