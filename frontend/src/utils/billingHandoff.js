export const BILLING_HANDOFF_PARAM = "bookingId";

export function buildBillingHandoffUrl(bookingId) {
  const id = String(bookingId || "").trim();

  if (!id) {
    return "/billing/new";
  }

  const params = new URLSearchParams({ [BILLING_HANDOFF_PARAM]: id });
  return `/billing/new?${params.toString()}`;
}
