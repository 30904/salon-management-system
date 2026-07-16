import { useState, useEffect } from "react";
import { formatInr } from "../../utils/earningsFormat.js";

/* ─── Precision helpers ─────────────────────────────────────── */
const pct = (total, fraction) => Number((total * fraction).toFixed(2));
const rem = (total, ...parts) => Number((total - parts.reduce((a, b) => a + b, 0)).toFixed(2));

export default function PaymentSplitModal({ isOpen, onClose, grandTotal = 0, onConfirm }) {
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [error, setError] = useState(null);

  /* Reset on open */
  useEffect(() => {
    if (isOpen) {
      setCashAmount("");
      setUpiAmount("");
      setUpiRef("");
      setCardAmount("");
      setCardRef("");
      setError(null);
    }
  }, [isOpen, grandTotal]);

  if (!isOpen) return null;

  const cash = Number(cashAmount) || 0;
  const upi = Number(upiAmount) || 0;
  const card = Number(cardAmount) || 0;
  const totalEntered = Number((cash + upi + card).toFixed(2));

  const diff = Number((grandTotal - totalEntered).toFixed(2));
  const isBalanced = Math.abs(diff) <= 1;

  /* Progress bar widths */
  const safeTot = grandTotal || 1;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const cashPct = useMemo(() => Math.min(100, (cash / safeTot) * 100), [cash, safeTot]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const upiPct = useMemo(() => Math.min(100, (upi / safeTot) * 100), [upi, safeTot]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const cardPct = useMemo(() => Math.min(100, (card / safeTot) * 100), [card, safeTot]);

  /* Fill remaining */
  const fillRemaining = (setter, current) => {
    const newVal = Number((current + diff).toFixed(2));
    if (newVal >= 0) setter(String(newVal));
  };

  /* Quick presets */
  const applyPreset = (preset) => {
    setError(null);
    switch (preset) {
      case "cash50upi50": {
        const half = pct(grandTotal, 0.5);
        setCashAmount(String(half)); setUpiAmount(String(rem(grandTotal, half))); setCardAmount("");
        break;
      }
      case "cash50card50": {
        const half = pct(grandTotal, 0.5);
        setCashAmount(String(half)); setUpiAmount(""); setCardAmount(String(rem(grandTotal, half)));
        break;
      }
      case "upi50card50": {
        const half = pct(grandTotal, 0.5);
        setCashAmount(""); setUpiAmount(String(half)); setCardAmount(String(rem(grandTotal, half)));
        break;
      }
      case "equal3": {
        const third = pct(grandTotal, 1 / 3);
        setCashAmount(String(third)); setUpiAmount(String(third)); setCardAmount(String(rem(grandTotal, third, third)));
        break;
      }
      case "clear":
        setCashAmount(""); setUpiAmount(""); setCardAmount("");
        break;
      default: break;
    }
  };

  /* Submit */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isBalanced) {
      setError(
        `Split total (₹${totalEntered.toFixed(2)}) must match Grand Total (₹${grandTotal.toFixed(2)}). ` +
        `Difference: ₹${Math.abs(diff).toFixed(2)} ${diff > 0 ? "still due" : "over-entered"}.`
      );
      return;
    }
    const splits = [];
    if (cash > 0) splits.push({ mode: "cash", amount: cash });
    if (upi > 0) splits.push({ mode: "upi", amount: upi, reference_id: upiRef.trim() || undefined });
    if (card > 0) splits.push({ mode: "card", amount: card, reference_id: cardRef.trim() || undefined });

    if (splits.length < 2) {
      setError("Enter amounts across at least two payment modes for a Split Payment.");
      return;
    }
    onConfirm(splits);
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pos-modal-backdrop" onClick={onClose}>
      <div className="pos-modal pos-modal--split" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="pos-modal-header"
          style={{ background: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)", borderBottom: "none" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#f8fafc", fontWeight: 800 }}>
              Split Payment
            </h3>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Distribute across Cash · UPI · Card
            </p>
          </div>
          <button type="button" className="pos-modal-close" onClick={onClose}
            style={{ color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pos-modal-body" style={{ padding: "1.25rem 1.5rem" }}>

            {/* ── Summary Banner ──────────────────────── */}
            <div className="pos-split-summary" style={{ marginBottom: "1rem" }}>
              <div className="pos-split-metric">
                <span>Grand Total</span>
                <strong style={{ color: "#0f172a" }}>{formatInr(grandTotal)}</strong>
              </div>
              <div className="pos-split-metric">
                <span>Entered</span>
                <strong style={{ color: isBalanced ? "#166534" : "#2563eb" }}>
                  {formatInr(totalEntered)}
                </strong>
              </div>
              <div className="pos-split-metric">
                <span>Remaining</span>
                <strong style={{ color: isBalanced ? "#166534" : diff > 0 ? "#dc2626" : "#d97706" }}>
                  {isBalanced
                    ? "Balanced"
                    : diff > 0
                      ? `−${formatInr(diff)}`
                      : `+${formatInr(Math.abs(diff))} over`}
                </strong>
              </div>
            </div>

            {/* ── Progress Bar ────────────────────────── */}
            <div style={{
              height: "10px", borderRadius: "999px", background: "#e2e8f0",
              overflow: "hidden", display: "flex", marginBottom: "0.6rem"
            }}>
              {cashPct > 0 && (
                <div style={{
                  width: `${cashPct}%`,
                  background: "linear-gradient(90deg,#10b981,#059669)",
                  transition: "width 0.3s ease"
                }} title={`Cash: ${formatInr(cash)}`} />
              )}
              {upiPct > 0 && (
                <div style={{
                  width: `${upiPct}%`,
                  background: "linear-gradient(90deg,#6366f1,#4f46e5)",
                  transition: "width 0.3s ease"
                }} title={`UPI: ${formatInr(upi)}`} />
              )}
              {cardPct > 0 && (
                <div style={{
                  width: `${cardPct}%`,
                  background: "linear-gradient(90deg,#f59e0b,#d97706)",
                  transition: "width 0.3s ease"
                }} title={`Card: ${formatInr(card)}`} />
              )}
            </div>

            {/* ── Legend ──────────────────────────────── */}
            {(cash > 0 || upi > 0 || card > 0) && (
              <div style={{
                display: "flex", gap: "1rem", flexWrap: "wrap",
                marginBottom: "1rem", fontSize: "0.78rem", fontWeight: 700
              }}>
                {cash > 0 && (
                  <span style={{ color: "#059669", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    Cash {formatInr(cash)}
                  </span>
                )}
                {upi > 0 && (
                  <span style={{ color: "#4f46e5", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                    UPI {formatInr(upi)}
                  </span>
                )}
                {card > 0 && (
                  <span style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                    Card {formatInr(card)}
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="status-error" style={{ marginBottom: "1rem", borderRadius: "8px" }}>
                {error}
              </div>
            )}

            {/* ── Quick Preset Chips ───────────────────── */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {[
                { key: "cash50upi50", label: "50% Cash + UPI" },
                { key: "cash50card50", label: "50% Cash + Card" },
                { key: "upi50card50", label: "50% UPI + Card" },
                { key: "equal3", label: "⅓ Each" },
                { key: "clear", label: "🧹 Clear" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  style={{
                    fontSize: "0.75rem", fontWeight: 700, padding: "0.35rem 0.8rem",
                    borderRadius: "999px", border: "1.5px solid #e2e8f0",
                    background: "#f8fafc", color: "#475569", cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e0e7ff";
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.color = "#4338ca";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.color = "#475569";
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Payment Rows ─────────────────────────── */}
            <div className="pos-split-grid">

              {/* Cash */}
              <div className="pos-split-row" style={{
                borderColor: cash > 0 ? "#10b981" : "#e2e8f0",
                background: cash > 0 ? "#f0fdf4" : "#ffffff",
                transition: "all 0.2s"
              }}>
                <div className="pos-split-label">
                  <span className="pos-split-icon" style={{ background: cash > 0 ? "#dcfce7" : "#f1f5f9", fontWeight: 700, fontSize: "0.75rem", color: "#166534" }}>
                    CASH
                  </span>
                  <div>
                    <strong>Cash</strong>
                    <span>Physical notes</span>
                  </div>
                </div>
                <div className="pos-split-input-wrap">
                  <span className="pos-currency">₹</span>
                  <input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    value={cashAmount}
                    onChange={(e) => { setCashAmount(e.target.value); setError(null); }}
                    style={{ borderColor: cash > 0 ? "#10b981" : undefined }}
                  />
                  {diff > 0 && (
                    <button
                      type="button" className="pos-quick-fill-btn"
                      onClick={() => fillRemaining(setCashAmount, cash)}
                      title={`Fill ₹${diff.toFixed(2)} here`}
                      style={{ background: "#10b981", color: "#fff" }}
                    >
                      Fill ₹{diff.toFixed(0)}
                    </button>
                  )}
                </div>
              </div>

              {/* UPI */}
              <div className="pos-split-row" style={{
                borderColor: upi > 0 ? "#6366f1" : "#e2e8f0",
                background: upi > 0 ? "#eef2ff" : "#ffffff",
                transition: "all 0.2s"
              }}>
                <div className="pos-split-label">
                  <span className="pos-split-icon" style={{ background: upi > 0 ? "#e0e7ff" : "#f1f5f9", fontWeight: 700, fontSize: "0.75rem", color: "#4338ca" }}>
                    UPI
                  </span>
                  <div>
                    <strong>UPI / QR</strong>
                    <span>GPay · PhonePe · Paytm</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
                  <div className="pos-split-input-wrap">
                    <span className="pos-currency">₹</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={upiAmount}
                      onChange={(e) => { setUpiAmount(e.target.value); setError(null); }}
                      style={{ borderColor: upi > 0 ? "#6366f1" : undefined }}
                    />
                    {diff > 0 && (
                      <button
                        type="button" className="pos-quick-fill-btn"
                        onClick={() => fillRemaining(setUpiAmount, upi)}
                        title={`Fill ₹${diff.toFixed(2)} here`}
                        style={{ background: "#6366f1", color: "#fff" }}
                      >
                        Fill ₹{diff.toFixed(0)}
                      </button>
                    )}
                  </div>
                  {upi > 0 && (
                    <input
                      type="text"
                      placeholder="UTR / Reference number (optional)"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      style={{
                        fontSize: "0.8rem", padding: "0.35rem 0.7rem",
                        borderRadius: "8px", border: "1px solid #c7d2fe",
                        background: "#eef2ff", color: "#4338ca", outline: "none"
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Card */}
              <div className="pos-split-row" style={{
                borderColor: card > 0 ? "#f59e0b" : "#e2e8f0",
                background: card > 0 ? "#fffbeb" : "#ffffff",
                transition: "all 0.2s"
              }}>
                <div className="pos-split-label">
                  <span className="pos-split-icon" style={{ background: card > 0 ? "#fef3c7" : "#f1f5f9", fontWeight: 700, fontSize: "0.75rem", color: "#b45309" }}>
                    CARD
                  </span>
                  <div>
                    <strong>Credit / Debit Card</strong>
                    <span>POS swipe · tap</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
                  <div className="pos-split-input-wrap">
                    <span className="pos-currency">₹</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={cardAmount}
                      onChange={(e) => { setCardAmount(e.target.value); setError(null); }}
                      style={{ borderColor: card > 0 ? "#f59e0b" : undefined }}
                    />
                    {diff > 0 && (
                      <button
                        type="button" className="pos-quick-fill-btn"
                        onClick={() => fillRemaining(setCardAmount, card)}
                        title={`Fill ₹${diff.toFixed(2)} here`}
                        style={{ background: "#f59e0b", color: "#0f172a" }}
                      >
                        Fill ₹{diff.toFixed(0)}
                      </button>
                    )}
                  </div>
                  {card > 0 && (
                    <input
                      type="text"
                      placeholder="Last 4 digits / Auth code (optional)"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value)}
                      style={{
                        fontSize: "0.8rem", padding: "0.35rem 0.7rem",
                        borderRadius: "8px", border: "1px solid #fde68a",
                        background: "#fffbeb", color: "#92400e", outline: "none"
                      }}
                    />
                  )}
                </div>
              </div>

            </div>{/* /pos-split-grid */}
          </div>{/* /pos-modal-body */}

          {/* Footer */}
          <div className="pos-modal-footer">
            <button type="button" className="user-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="user-primary-btn"
              disabled={!isBalanced}
              style={{
                background: isBalanced
                  ? "linear-gradient(135deg,#10b981 0%,#059669 100%)"
                  : "#94a3b8",
                cursor: isBalanced ? "pointer" : "not-allowed",
                fontWeight: 800,
                minWidth: "210px",
                boxShadow: isBalanced ? "0 4px 14px rgba(16,185,129,0.4)" : "none",
                transition: "all 0.2s"
              }}
            >
              {isBalanced
                ? `Confirm Split · ${formatInr(totalEntered)}`
                : diff > 0
                  ? `Still due: ${formatInr(diff)}`
                  : `Over by: ${formatInr(Math.abs(diff))}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
