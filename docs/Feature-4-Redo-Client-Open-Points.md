# Feature 4 — Redo / rework client open points (handover)

**Tracker row 3 Gate + row 25** · For client / owner sign-off before enabling payroll product-cost cuts in production.

Implementation uses **named defaults** in `backend/constants/redoConstants.js`. Do not change defaults silently — confirm below with the salon owner, then flip the payroll gate.

---

## Payroll gate (money on paychecks)

| Item | Current value | Where |
|------|---------------|--------|
| Payroll product-cost deduction live? | **`false` (OFF)** | `REDO_PAYROLL_DEDUCTION_ENABLED` in `redoConstants.js` |

Until this is `true`, completed redos may still create ₹0 invoices and stock movements, but **Run Payroll must not subtract product cost from net pay**.

Flip to `true` only after all 4.7 items below are checked off.

---

## 4.7 Open points — coded defaults

### (a) Which staff is deducted

| Item | Shipped default |
|------|-----------------|
| Deduction target | `redo_staff_id` (staff who performs the redo) |
| Request default | Same as original line `staff_id`, editable when requesting |

**Client to confirm**

- [ ] Deduct the redo stylist (editable), not always the original stylist only?
- [ ] Or always charge original stylist regardless of who performs the redo?

---

### (b) Cost basis

| Item | Shipped default |
|------|-----------------|
| Unit cost | `ProductMaster.purchase_price` (not `sale_price`) |
| When snapshotted | At redo **complete** time |

**Client to confirm**

- [ ] Purchase / cost price is correct for salary cut?
- [ ] Snapshot at complete (stable for payroll) is OK?

---

### (c) Redo window

| Item | Shipped default |
|------|-----------------|
| Window | **7 days** from original `invoice.billing_date` |
| Constant | `REDO_WINDOW_DAYS` |

**Client to confirm**

- [ ] Is **7 days** correct, or another number (e.g. 3 / 14)?

---

### (d) Service-only redo (no products)

| Item | Shipped default |
|------|-----------------|
| No products used | `total_product_cost = 0` → **no salary cut** |
| Still create | Free ₹0 redo invoice + history link |

**Client to confirm**

- [ ] Service-only redo stays free for customer with **no** staff cut?

---

### (e) One redo per original service line

| Item | Shipped default |
|------|-----------------|
| Limit | One non-rejected `RedoRequest` per `original_line_item_id` |
| After reject | A new request may be created |

**Client to confirm**

- [ ] One redo per original service line is correct?
- [ ] Or allow multiple redos on the same line?

---

## After sign-off

1. Update any defaults in `redoConstants.js` if the client chose differently.
2. Set `REDO_PAYROLL_DEDUCTION_ENABLED = true`.
3. Mark tracker **Open points / Confirm 4.7** (row 25) **Done**.
4. Re-generate a draft payroll and verify `redo_product_cost_deduction` before finalize.
