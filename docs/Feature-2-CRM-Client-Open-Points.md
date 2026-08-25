# Feature 2 — CRM client open points (handover)

**Tracker row 34** · For client / owner sign-off before calling Feature 2 production-complete.

Implementation uses **named defaults** that are adjustable without redeploy where noted. Do not change code silently — confirm the items below with the salon owner.

---

## 1. Inactive-visit alert threshold

| Item | Shipped default | Where to change |
|------|-----------------|-----------------|
| Default inactive window | **60 days** | `backend/services/crmAlertService.js` → `DEFAULT_INACTIVE_THRESHOLD_DAYS` |
| API override | `GET /api/customers/inactive?threshold_days=` | Query param on every request |
| Desktop UI | **30 / 45 / 60 / 90** day buttons | `frontend/src/pages/crm/CrmInactiveCustomers.jsx` |

**Client to confirm**

- [ ] Is **60 days** the correct salon default for “has not visited recently”?
- [ ] Are **30 / 45 / 60 / 90** sufficient UI choices, or should other values be added?

**Notes for handover**

- Visit date = latest **paid/partial invoice** `billing_date`; else `imported_last_visit_date`; else never visited (always inactive).
- Threshold is **not** hardcoded only in the UI — backend default is a named constant; UI re-queries the API when the user changes days.

---

## 2. Customer import file headers

| Item | Shipped mapping | Where to change |
|------|-----------------|-----------------|
| Client file used for seed | `Contacts-24-Aug-02-31.xlsx` (repo root, gitignored PII) | `backend/constants/customerImportConstants.js` |
| Sheet name | `contactbackup` | Same file |
| Column map | See table below | `CLIENT_CONTACTS_COLUMN_MAP` + `CUSTOMER_IMPORT_HEADER_ALIASES` in `customerImportService.js` |

**Locked column map (Aug 2026 client file)**

| Spreadsheet header | Maps to |
|--------------------|---------|
| SNo | `import_row_ref` (audit only) |
| Full Name | `name` (required) |
| Mobile 1–4 | First valid 10-digit → `phone`; unused mobiles → `notes` |
| Email | `notes` (`Email: …`) |
| Address | `notes` (`Address: …`) |
| dob / gender / last_visit | Not in file → left null |

**Client to confirm**

- [ ] Future bulk imports will use the **same headers** as `Contacts-24-Aug-02-31.xlsx`.
- [ ] If a different export format is used later, only the header alias map needs updating (one config location — not scattered logic).

**Notes for handover**

- Generic MD columns (`name`, `phone`, `dob`, `gender`, `last_visit_date`, `notes`) are also supported for CSV/XLSX uploads via the import API.
- Phone is the **unique merge key**; re-import merges empty fields only (never overwrites name/phone).

---

## 3. Already decided in spec (no further sign-off needed for row 34)

- Desktop CRM only for inactive/import v1 (no mobile inactive screen).
- CRM list lazy load: page size **25** (max **50**) — see `.cursor/rules/crm-lazy-load.mdc`.

---

## Sign-off

| Topic | Client decision | Date | Initials |
|-------|-----------------|------|----------|
| Inactive threshold default (60 days) | | | |
| Inactive UI options (30/45/60/90) | | | |
| Import headers match Contacts export | | | |

---

*Generated for Pending Client Changes tracker — Sheet `02 Customer-Import-CRM` row 34.*
