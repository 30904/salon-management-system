export const barGradientStops = [
  { bottom: "#0f766e", mid: "#14b8a6", top: "#5eead4" },
  { bottom: "#0369a1", mid: "#0ea5e9", top: "#7dd3fc" },
  { bottom: "#15803d", mid: "#22c55e", top: "#86efac" },
  { bottom: "#b45309", mid: "#f59e0b", top: "#fcd34d" },
  { bottom: "#6d28d9", mid: "#8b5cf6", top: "#c4b5fd" },
  { bottom: "#be123c", mid: "#f43f5e", top: "#fda4af" },
];

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function createBarGradient(chart, index, { hover = false } = {}) {
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return barGradientStops[index % barGradientStops.length].mid;
  }

  const stops = barGradientStops[index % barGradientStops.length];
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

  gradient.addColorStop(0, stops.bottom);
  gradient.addColorStop(0.5, hover ? stops.top : stops.mid);
  gradient.addColorStop(1, stops.top);

  return gradient;
}

export const barTrackPlugin = {
  id: "barTrack",
  beforeDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const datasetIndex = chart.data.datasets.length - 1;
    const meta = chart.getDatasetMeta(datasetIndex);

    if (!meta?.data?.length || !scales.y) {
      return;
    }

    const trackTop = scales.y.getPixelForValue(scales.y.max);
    const trackBottom = scales.y.getPixelForValue(scales.y.min);

    ctx.save();

    meta.data.forEach((bar) => {
      if (!bar || bar.hidden) {
        return;
      }

      const left = bar.x - bar.width / 2;
      const height = trackBottom - trackTop;

      drawRoundedRect(ctx, left, trackTop, bar.width, height, 12);
      ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
      ctx.fill();

      drawRoundedRect(ctx, left, trackTop, bar.width, height, 12);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.restore();
  },
};

export const barValueLabelPlugin = {
  id: "barValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const datasetIndex = chart.data.datasets.length - 1;
    const dataset = chart.data.datasets[datasetIndex];
    const meta = chart.getDatasetMeta(datasetIndex);

    if (!dataset || !meta?.data?.length) {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font =
      '700 11px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    meta.data.forEach((bar, index) => {
      if (!bar || bar.hidden) {
        return;
      }

      const value = Number(dataset.data[index] || 0);
      ctx.fillStyle = "#102a43";
      ctx.fillText(value.toLocaleString("en-IN"), bar.x, bar.y - 10);
    });

    ctx.restore();
  },
};

export const barGlowPlugin = {
  id: "barGlow",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const datasetIndex = chart.data.datasets.length - 1;
    const meta = chart.getDatasetMeta(datasetIndex);

    if (!meta?.data?.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "destination-over";

    meta.data.forEach((bar) => {
      if (!bar || bar.hidden) {
        return;
      }

      const left = bar.x - bar.width / 2;
      const top = bar.y - 4;
      const height = chart.scales.y.getPixelForValue(0) - bar.y + 4;

      drawRoundedRect(ctx, left + 2, top + 2, bar.width, height, 12);
      ctx.fillStyle = "rgba(15, 118, 110, 0.08)";
      ctx.fill();
    });

    ctx.restore();
  },
};
