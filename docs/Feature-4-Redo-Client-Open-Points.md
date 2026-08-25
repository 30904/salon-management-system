# Feature 4 — Redo / rework client open points (handover)

**Tracker row 3 Gate + row 25** · For client / owner sign-off before enabling payroll product-cost cuts in production.

Implementation uses **named defaults** in `backend/constants/redoConstants.js`. Do not change defaults silently — confirm below with the salon owner, then flip the payroll gate.

Build status: Feature 4 UI + APIs + MD 4.8 tests are Done. **Payroll deduction gate remains OFF** until this checklist is signed.

---

## Payroll gate (money on paychecks)

| Item | Current value | Where |
|------|---------------|--------|
| Payroll product-cost deduction live? | **`false` (OFF)** | `REDO_PAYROLL_DEDUCTION_ENABLED` in `redoConstants.js` (or env `REDO_PAYROLL_DEDUCTION_ENABLED=true` for tests only) |

Until this is `true`, completed redos may still create ₹0 invoices and stock movements, but **Run Payroll must not subtract product cost from net pay**.

Flip to `true` only after all 4.7 items below are checked off.

Verify gate still OFF anytime: `npm run test:redo-gate` (from `backend/`).

---

## 4.7 Open points — coded defaults

### (a) Which staff is deducted

| Item | Shipped default | Constant / code |
|------|-----------------|-----------------|
| Deduction target | `redo_staff_id` (staff who performs the redo) | `REDO_DEDUCTION_STAFF_FIELD` |
| Request default | Same as original line `staff_id`, editable when requesting | Request Redo form |

**Client to confirm**

- [ ] Deduct the redo stylist (editable), not always the original stylist only?
- [ ] Or always charge original stylist regardless of who performs the redo?

---

### (b) Cost basis

| Item | Shipped default | Constant / code |
|------|-----------------|-----------------|
| Unit cost | `ProductMaster.purchase_price` (not `sale_price`) | `REDO_COST_BASIS_FIELD` |
| When snapshotted | At redo **complete** time | `completeRedoRequest` |

**Client to confirm**

- [ ] Purchase / cost price is correct for salary cut?
- [ ] Snapshot at complete (stable for payroll) is OK?

---

### (c) Redo window

| Item | Shipped default | Constant / code |
|------|-----------------|-----------------|
| Window | **7 days** from original `invoice.billing_date` | `REDO_WINDOW_DAYS` |
| FE source | `GET /api/redo/config` → `redo_window_days` | Do not hardcode in UI |

**Client to confirm**

- [ ] Is **7 days** correct, or another number (e.g. 3 / 14)?

---

### (d) Service-only redo (no products)

| Item | Shipped default | Constant / code |
|------|-----------------|-----------------|
| No products used | `total_product_cost = 0` → **no salary cut** | `REDO_SERVICE_ONLY_ALLOWS_ZERO_COST` |
| Still create | Free ₹0 redo invoice + history link | Complete path |

**Client to confirm**

- [ ] Service-only redo stays free for customer with **no** staff cut?

---

### (e) One redo per original service line

| Item | Shipped default | Constant / code |
|------|-----------------|-----------------|
| Limit | One non-rejected `RedoRequest` per `original_line_item_id` | `REDO_ONE_PER_ORIGINAL_LINE` |
| After reject | A new request may be created | Reject then re-request |

**Client to confirm**

- [ ] One redo per original service line is correct?
- [ ] Or allow multiple redos on the same line?

---

## Live paths (for demo / UAT)

| Step | Route / UI | Permission |
|------|------------|------------|
| Request | Invoice detail **Request Redo**, or `/redo/request?invoiceId=` | `billing.edit` |
| Approve / Reject | `/redo/approvals` (also Payroll home) | `payroll.edit` |
| Complete visit | `/redo/complete` | `billing.edit` |
| See deduction line | Run Payroll + My Earnings (shows `-₹X` when gate ON) | `payroll.view` |

---

## After owner sign-off

1. Update any defaults in `redoConstants.js` if the client chose differently (one-line constants).
2. Set `REDO_PAYROLL_DEDUCTION_ENABLED = true` (or production env `REDO_PAYROLL_DEDUCTION_ENABLED=true`).
3. Confirm `npm run test:redo-gate` expectations are updated if the gate is intentionally ON.
4. Re-generate a draft payroll and verify `redo_product_cost_deduction` before finalize.
5. Record sign-off date + decisions (a)–(e) in this file or the tracker Notes.

**Do not enable the gate on assumptions.** Until then, Feature 4 redo flow works end-to-end except paycheck cuts.
