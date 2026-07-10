export const chartColors = {
  primary: "#4f46e5",
  secondary: "#06b6d4",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
  muted: "#9ca3af",
};

export const chartPalette = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.success,
  chartColors.warning,
  chartColors.danger,
  "#8b5cf6",
  "#ec4899",
];

export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
        usePointStyle: true,
      },
    },
  },
};
