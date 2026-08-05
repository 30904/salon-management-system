import { normalizeWhatsAppPhone } from "./whatsappBooking.js";

/**
 * Prefill WhatsApp message after a package credit is redeemed at POS.
 */
export function buildPackageCreditUsedMessage({
  customerName,
  packageName,
  creditsUsed = 1,
  creditsRemaining,
  creditsTotal,
} = {}) {
  const name = customerName || "Customer";
  const pkg = packageName || "your package";
  const used = Number(creditsUsed) || 1;
  const remaining = Number(creditsRemaining);
  const total = Number(creditsTotal);

  const remainingLine = Number.isFinite(remaining)
    ? Number.isFinite(total) && total > 0
      ? `Remaining credits: ${remaining} of ${total}.`
      : `Remaining credits: ${remaining}.`
    : "Please check with the salon for your remaining balance.";

  return [
    `Hello ${name},`,
    ``,
    `You have availed ${used} service credit(s) from ${pkg} at S21 Family Salon.`,
    remainingLine,
    remaining === 0
      ? `Your package credits are now fully used.`
      : `Thank you — we look forward to serving you again!`,
  ].join("\n");
}

export function buildPackageBalanceMessage({
  customerName,
  packageName,
  creditsRemaining,
  creditsTotal,
} = {}) {
  const name = customerName || "Customer";
  const pkg = packageName || "your package";
  const remaining = Number(creditsRemaining) || 0;
  const total = Number(creditsTotal);

  const balanceLine =
    Number.isFinite(total) && total > 0
      ? `You have ${remaining} of ${total} credits remaining on ${pkg}.`
      : `You have ${remaining} credit(s) remaining on ${pkg}.`;

  return [
    `Hello ${name},`,
    ``,
    `Package update from S21 Family Salon:`,
    balanceLine,
    ``,
    `Thank you!`,
  ].join("\n");
}

function buildWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function openWhatsAppWithMessage(phone, message) {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    window.alert("This customer has no valid phone number for WhatsApp.");
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function buildPackageCreditUsedWhatsAppUrl(payload) {
  return buildWhatsAppUrl(
    payload?.customerPhone || payload?.phone,
    buildPackageCreditUsedMessage(payload)
  );
}

export function openPackageCreditUsedWhatsApp(payload) {
  return openWhatsAppWithMessage(
    payload?.customerPhone || payload?.phone,
    buildPackageCreditUsedMessage(payload)
  );
}

export function openPackageBalanceWhatsApp(payload) {
  return openWhatsAppWithMessage(
    payload?.customerPhone || payload?.phone,
    buildPackageBalanceMessage(payload)
  );
}

/**
 * Build redemption summaries from POS cart + active packages (before cart reset).
 */
export function buildRedemptionSummariesFromCart({
  cartItems = [],
  activePackages = [],
  customer,
} = {}) {
  const usedByPkg = new Map();

  cartItems.forEach((ci) => {
    if (!ci?._is_redeemed_pkg_line || !ci.package_redemption_id) return;
    const id = String(ci.package_redemption_id);
    usedByPkg.set(id, (usedByPkg.get(id) || 0) + (Number(ci.quantity) || 1));
  });

  const summaries = [];
  usedByPkg.forEach((creditsUsed, pkgId) => {
    const pkg = activePackages.find(
      (row) => String(row.id || row._id) === pkgId
    );
    if (!pkg) return;

    const master = pkg.package_master || pkg.package_master_id || {};
    const creditsTotal = Number(master.credit_count || 0);
    const before = Number(pkg.credits_remaining || 0);
    const creditsRemaining = Math.max(0, before - creditsUsed);

    summaries.push({
      packageId: pkgId,
      packageName: master.name || "Package",
      creditsUsed,
      creditsRemaining,
      creditsTotal,
      customerName: customer?.name || "Customer",
      customerPhone: customer?.phone || null,
    });
  });

  return summaries;
}
