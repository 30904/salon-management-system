import { formatInr } from "./earningsFormat.js";

/**
 * Label for amount_wallet package lines on receipts.
 * Paid amount stays on Rate/Total; this only clarifies wallet credit.
 */
export function getWalletPackageLabel(line) {
  if (!line || line.item_type !== "package") return null;

  const walletValue = Number(line.wallet_value);
  if (!Number.isFinite(walletValue) || walletValue <= 0) return null;

  const paid = Number(line.unit_price || line.package_price || 0);
  if (Number.isFinite(paid) && paid > 0 && paid !== walletValue) {
    return `Paid ${formatInr(paid)} · Wallet credit ${formatInr(walletValue)}`;
  }

  return `Wallet credit ${formatInr(walletValue)}`;
}
