const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function isMongoObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

export function readEntityLabel(value, fallback = "") {
  if (!value) return fallback;
  if (typeof value === "string") {
    return isMongoObjectId(value) ? fallback : value;
  }
  if (typeof value === "object" && value.name) return value.name;
  return fallback;
}

export function formatInr(amount) {
  return inrFormatter.format(Number(amount || 0));
}

export function formatPeriodLabel(month, year) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatLiveClock(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDayName(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-IN", { weekday: "long" }).toUpperCase();
}

export function formatDateBadge(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    year: d.getFullYear(),
  };
}

export function buildMonthOptions(count = 6) {
  const options = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    options.push({
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      label: formatPeriodLabel(date.getMonth() + 1, date.getFullYear()),
    });
  }

  return options;
}

export const MONTH_OPTIONS = buildMonthOptions();
