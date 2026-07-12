const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount) {
  return inrFormatter.format(Number(amount || 0));
}

export function formatPeriodLabel(month, year) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMonthOptions(count = 12) {
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

const MONTH_OPTIONS = buildMonthOptions();

export default MONTH_OPTIONS;
