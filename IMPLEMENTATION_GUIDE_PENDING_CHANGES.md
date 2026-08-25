# Salon S21 — Implementation Guide: 4 Pending Client Change Requests

**Target codebase:** `Salon-management-new` (dev-arnav branch).

**⚠️ READ THIS FIRST — Live vs Dead code.** This repo contains two parallel systems. Only the **live** one is mounted and reachable. Every instruction below touches ONLY live files. Do NOT touch, extend, or copy patterns from the dead/legacy files listed at the bottom of this doc (section 0.3) — they are not wired into the running app and editing them does nothing.

Backend entry: `backend/server.js` → `backend/routes/index.js` → `arnavRoutes.js` + `preciousRoutes.js`.
Frontend entry: `frontend/src/App.jsx` → `routes/index.jsx` → `appShellRoute.jsx` → `arnavRoutes.jsx` + `preciousRoutes.jsx`.
Mobile entry: `frontend-mobile/src/App.jsx`.

Backend business logic lives in `backend/services/*.js` (ESM, transaction-aware via `backend/utils/withTransaction.js`). Routes are thin adapters that validate input and call services. **Always follow this pattern for new logic** — do not put business logic directly in route handlers beyond basic validation.

Response shape everywhere: `{success: true/false, data, message}` via `backend/utils/apiResponse.js` (`sendSuccess`/`sendError`). Wrap all async route handlers in `backend/utils/asyncHandler.js`.

Auth: every live route file does `router.use(authenticate)` (`backend/middleware/authenticate.js`) then per-route `requirePermission(module, action)` (`backend/middleware/requirePermission.js`). Permissions are resolved via `backend/services/permissionService.js` against the `Permission`/`RolePermission`/`UserMenuOverride` models — NOT the old `config/permissions.js` map.

---

## 0. Ground rules for every feature below

### 0.1 Backend pattern to copy
Use `backend/services/billingController.js` + `backend/services/billingService.js` as the reference implementation for anything touching money/stock:
1. Route handler validates request shape, resolves related entities, does read-only pre-checks.
2. All writes happen inside `await withTransaction(async (session) => { ... })` from `backend/utils/withTransaction.js`.
3. Stock changes ALWAYS go through `backend/services/stockService.js` (`deductStock`/`addStock`) — never mutate `ProductMaster.current_stock` directly. This keeps `AuditLog` consistent.
4. Never trust client-computed totals — recompute server-side.

### 0.2 Frontend pattern to copy
- New API calls go in a new file under `frontend/src/api/arnav/` or `frontend/src/api/precious/` (whichever domain fits), thin wrapper style:
  ```js
  import { apiClient } from '../client';
  export async function listXyz(params) {
    const { data } = await apiClient.get('/xyz', { params });
    return data;
  }
  ```
  Re-export from `frontend/src/api/index.js` under `arnavApi`/`preciousApi`.
- New pages hand-roll markup like `frontend/src/pages/settings/products/ProductList.jsx` / `ProductForm.jsx` and `frontend/src/pages/payroll/RunPayroll.jsx` (table with class `user-table`, cards with `user-table-card`, `module-hero-header`, `status-card`) — do NOT try to reuse `components/DataTable.jsx`/`FormField.jsx`/`Modal.jsx`, they are dead/unused by the live tree.
- Register new pages in `frontend/src/routes/arnavRoutes.jsx` or `preciousRoutes.jsx` using the existing `guardedRoute(path, importFn, {module, action})` helper — this ties the route to the permission system automatically.
- Mobile equivalent: `frontend-mobile/src/api/*.js` + pages registered in `frontend-mobile/src/App.jsx` with `<ProtectedRoute module="...">`.

### 0.3 DO NOT TOUCH (dead/legacy, unmounted — any edit here has zero effect on the running app)
`backend/models/Employee.js`, `Package.js`, `Shift.js`, `SalaryTemplate.js`, `DiscountRule.js`, `BillingConfig.js`, `AttendanceConfig.js`, `CalendarEvent.js`, `Payroll.js`, `StockMovement.js`, `models/index.js`; `backend/middleware/auth.js`, `rbac.js`; `backend/config/permissions.js`; `backend/controllers/settings/*`; `backend/routes/settingsRoutes.js`, `employeeRoutes.js`, `invoiceRoutes.js`, `attendanceRuleRoutes.js`; `backend/controllers/employeeController.js`, `invoiceController.js`, `attendanceController.js`, `payrollController.js`; `frontend/src/routes/AppRoutes.jsx` and pages only it imports (`EmployeesPage.jsx`, `BillingPosPage.jsx`, `PayrollPage.jsx`, `AttendancePage.jsx`, `CustomersPage.jsx`, `InventoryPage.jsx`, `CampaignsPage.jsx`, all of `pages/settings/*SettingsPage.jsx`); `frontend/src/services/api.js`; `frontend/src/components/DataTable.jsx`, `FormField.jsx`, `Modal.jsx`; `frontend-mobile/src/routes/AppRoutes.jsx` and its exclusive pages (`HomePage.jsx`, `AttendanceHistoryPage.jsx`, `MySchedulePage.jsx`, `TeamOverviewPage.jsx`, `MyEarningsPage.jsx`, `PayslipPage.jsx`, `LoginPage.jsx`, `ProfilePage.jsx`, `PlaceholderPage.jsx`); `frontend-mobile/src/services/api.js`.

If you are ever unsure whether a file is live, check: is it imported (directly or transitively) from `backend/routes/index.js` / `frontend/src/routes/index.jsx` / `frontend-mobile/src/App.jsx`? If not, it's dead.

---

## FEATURE 1 — Per-employee late-mark buffer

**Priority: build this first.** Smallest, most isolated change.

### 1.1 What exists today
- `backend/models/AttendanceRule.js`: `{name, late_mark_minutes (default 10), leave_types, branch_id, is_active}` — this is a **branch-level** rule, resolved by `getLateMarkMinutesForBranch()` inside `backend/services/attendancePunchService.js`.
- Late status is computed in `attendancePunchService.resolveAutoPunchInStatus()`: converts punch time to `Asia/Kolkata`, computes `thresholdMinutes = shiftStartMinutes + lateMarkMinutes`, compares to punch time. Called from `resolvePunchInStatus({targetStaff, punchInDate, explicitStatus})`.
- Resolution order today: branch-specific `AttendanceRule` → global (`branch_id:null`) `AttendanceRule` → hardcoded `DEFAULT_LATE_MARK_MINUTES = 10`.

### 1.2 Schema change
Add a field to `backend/models/StaffProfile.js`:
```js
late_mark_buffer_minutes: { type: Number, default: null, min: 0, max: 30 }
```
`null`/unset = "use salon default" (current behavior unchanged). This is additive — no migration needed for existing docs (Mongoose treats missing field as `null`/undefined automatically for a schema field with no `required`).

### 1.3 Backend logic change
In `backend/services/attendancePunchService.js`, find `resolvePunchInStatus()`. It currently does roughly:
```js
const lateMarkMinutes = await getLateMarkMinutesForBranch(branchId);
```
Change resolution order to check the staff's personal override FIRST:
```js
async function resolveLateMarkMinutesForStaff(staff, branchId) {
  if (staff.late_mark_buffer_minutes !== null && staff.late_mark_buffer_minutes !== undefined) {
    return staff.late_mark_buffer_minutes;
  }
  return getLateMarkMinutesForBranch(branchId); // existing function, unchanged
}
```
Replace the call site in `resolvePunchInStatus()`:
```js
const lateMarkMinutes = await resolveLateMarkMinutesForStaff(targetStaff, branchId);
```
Make sure `targetStaff` passed into `resolvePunchInStatus()` already includes `late_mark_buffer_minutes` (it's loaded from `StaffProfile`, so it will be present automatically once the schema field above is added — no extra query needed).

Everything downstream (`resolveAutoPunchInStatus`, 3-lates-per-month rule in `backend/constants/leaveConstants.js`, `attendanceSummaryService.getMonthlyAttendanceSummary()`) is untouched — they consume the already-computed `status`, they don't care how the buffer was resolved.

### 1.4 Backend API change
`backend/routes/staffRoutes.js` already has update endpoints for `StaffProfile` (inline handlers, see `PATCH`/`PUT` staff routes). Add `late_mark_buffer_minutes` to the whitelist of fields the update handler accepts and writes. Validate: if provided, must be integer 0–30 or `null`. Reject with 400 otherwise.

No new endpoint is needed — this rides on the existing staff update route.

### 1.5 Frontend (desktop) change
File: `frontend/src/pages/settings/staff/StaffForm.jsx`.
- Add a new form field: "Late mark buffer (minutes)" — numeric input, placeholder "Default (10 min)", range 0–30, optional (blank = use salon default).
- Add it near the existing shift/salary fields.
- On submit, include `late_mark_buffer_minutes: value === '' ? null : Number(value)` in the payload sent to the staff update API.
- On load (edit mode), pre-fill from `staff.late_mark_buffer_minutes` if present, else leave blank.
- Display rule: label placeholder text should read "Default (10 min)" but if a branch-level `AttendanceRule` with a different default exists, that's a nice-to-have not required for v1 — do not build branch-lookup here, plain "Default (10 min)" placeholder is sufficient.

File: `frontend/src/pages/settings/staff/StaffList.jsx` — optionally show the configured buffer as a column (e.g. "Late buffer: 5 min" or "Late buffer: Default"). Not required, but do it if trivial given the existing table markup.

### 1.6 Permission
Editing is a `staff` module field — reuse whatever permission already gates `StaffForm.jsx` save (`staff:edit` or equivalent — check `usePermission()` call already present in that file and follow the same module/action pair). Do not invent a new permission module for this.

### 1.7 Test checklist
- Set staff A's buffer to 5 min, staff B's to 15 min, leave staff C blank.
- Staff A punches in shift_start+7min → should be `late`. Staff B punches in shift_start+7min → should be `present`. Staff C punches in shift_start+7min → should be `present` if salon default is 10 (unchanged behavior).
- Blank/null buffer must NOT be sent as `0` — 0 minutes means "any lateness is late", which is a different, valid configuration from "use default". Verify the form distinguishes empty string from `0`.
- Existing branch-level `AttendanceRule` behavior must remain unchanged for staff with no personal override.

---

## FEATURE 2 — Customer database import + inactive-visit CRM alert

### 2.1 What exists today
- `backend/models/Customer.js`: `{name, phone (unique index), dob, anniversary_date, gender, tags:[{label,type}], preferred_stylist_id, notes}`. This is the entire CRM record — no separate "CRM" model.
- Customers are created today via `arnavApi.findOrCreateCustomer` (inline quick-create in `frontend/src/pages/billing/PosScreen.jsx`) or `backend/routes/customerRoutes.js` → `backend/services/customerService.js`.
- CRM pages: `frontend/src/pages/crm/CrmHome.jsx` (main), `CrmPendingCredits.jsx` (uses `backend/services/packageAlertService.js` for package-expiry alerts — same pattern we'll copy for inactivity alerts), `CrmWhatsAppOffers.jsx`.
- "Last visit" is NOT a stored field today — it must be derived from the latest `Invoice.billing_date` (or paid invoice) for that customer, OR from an imported value until a real S21 visit happens.

### 2.2 Schema change — `backend/models/Customer.js`
Add:
```js
imported_last_visit_date: { type: Date, default: null },   // from import file, used only until a real S21 invoice exists
source: { type: String, enum: ['app', 'import'], default: 'app' },
import_batch_id: { type: String, default: null },          // groups rows from one import run, for audit/rollback
import_row_ref: { type: String, default: null }             // original row identifier/notes if useful for support
```
Do NOT remove or repurpose any existing field. `phone` stays the unique dedupe key (matches requirement 2's "duplicates on phone number merged/skipped").

### 2.3 New model — `backend/models/CustomerImportBatch.js` (new file)
Tracks each import run for audit/traceability:
```js
import mongoose from 'mongoose';
const CustomerImportBatchSchema = new mongoose.Schema({
  file_name: { type: String, required: true },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  total_rows: { type: Number, required: true },
  created_count: { type: Number, default: 0 },
  merged_count: { type: Number, default: 0 },
  skipped_count: { type: Number, default: 0 },
  error_rows: { type: mongoose.Schema.Types.Mixed, default: [] }, // [{row, reason}]
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
}, { timestamps: true });
export default mongoose.model('CustomerImportBatch', CustomerImportBatchSchema);
```

### 2.4 Backend — import endpoint
New file `backend/services/customerImportService.js`:
- `parseCustomerImportFile(buffer, mimeType)` — parse CSV or XLSX. Use `xlsx` npm package (check `backend/package.json`; add it if missing via `npm install xlsx` in `backend/`) to handle both `.csv` and `.xlsx` uniformly. Expected columns (case-insensitive header match): `name` (required), `phone` (required, normalize by stripping spaces/`+91`/dashes to bare 10-digit), `dob` (optional, parse common date formats), `gender` (optional), `last_visit_date` (optional), `notes` (optional).
- `importCustomers({rows, uploadedBy, fileName})`:
  1. Create a `CustomerImportBatch` doc with `status:'processing'`.
  2. For each row: validate `name` + `phone` present and `phone` is 10 digits. If invalid → push to `error_rows`, skip.
  3. Look up existing `Customer` by `phone`.
     - If not found → create new `Customer` with `source:'import'`, `imported_last_visit_date: row.last_visit_date || null`, `import_batch_id`. Increment `created_count`.
     - If found → **merge, don't overwrite silently**: only fill fields that are currently empty on the existing record (`dob`, `gender`, `notes`, `imported_last_visit_date` if the existing customer has no real invoice yet). Never overwrite `name`/`phone`. Increment `merged_count`.
  4. Update batch doc with final counts and `status:'completed'` (or `'failed'` if a hard error occurred).
  5. Return the batch summary.
- This whole operation does NOT need `withTransaction` money-grade atomicity (no billing/stock involved), but wrap the create/update loop in a single Mongoose session anyway for consistency with the rest of the codebase, OR keep it row-by-row with per-row error capture (preferred here — a single bad row should not abort the whole file). Use row-by-row with try/catch per row, not a transaction.

New route in `backend/routes/customerRoutes.js`:
```js
router.post('/import', requirePermission('crm', 'edit'), upload.single('file'), asyncHandler(importCustomersHandler));
router.get('/import/:batchId', requirePermission('crm', 'view'), asyncHandler(getImportBatchHandler));
```
Use `multer` for `upload.single('file')` (check if already a dependency in `backend/package.json`; it's commonly already present because of other file-upload flows — search `backend/routes` for existing `multer` usage and copy the exact config, e.g. memory storage, 5MB limit, mimetype filter for `csv`/`xlsx`).

Controller `importCustomersHandler`: parse `req.file.buffer` via `customerImportService.parseCustomerImportFile`, call `importCustomers(...)`, `sendSuccess(res, {data: batchSummary})`.

### 2.5 Backend — inactive customers alert endpoint
Add to `backend/services/customerService.js` (or a new `crmAlertService.js` if `customerService.js` is already large — check file length first, keep under ~300 lines per file, split if needed):

```js
async function getInactiveCustomers({ thresholdDays, branchId }) {
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  // Get latest paid invoice date per customer
  const latestInvoiceByCustomer = await Invoice.aggregate([
    { $match: { payment_status: { $in: ['paid', 'partial'] } } },
    { $sort: { billing_date: -1 } },
    { $group: { _id: '$customer_id', lastVisit: { $first: '$billing_date' } } },
  ]);
  const lastVisitMap = new Map(latestInvoiceByCustomer.map(r => [String(r._id), r.lastVisit]));

  const customers = await Customer.find({}).lean();
  const inactive = customers
    .map(c => {
      const realVisit = lastVisitMap.get(String(c._id));
      const effectiveLastVisit = realVisit || c.imported_last_visit_date || null;
      return { ...c, effective_last_visit: effectiveLastVisit };
    })
    .filter(c => {
      if (!c.effective_last_visit) return true; // never visited = definitely inactive, surface them
      return new Date(c.effective_last_visit) < cutoff;
    })
    .map(c => ({
      ...c,
      days_since_last_visit: c.effective_last_visit
        ? Math.floor((Date.now() - new Date(c.effective_last_visit).getTime()) / (24 * 60 * 60 * 1000))
        : null,
    }))
    .sort((a, b) => (b.days_since_last_visit ?? Infinity) - (a.days_since_last_visit ?? Infinity));

  return inactive;
}
```
Route in `backend/routes/customerRoutes.js`:
```js
router.get('/inactive', requirePermission('crm', 'view'), asyncHandler(getInactiveCustomersHandler));
```
Handler reads `threshold_days` from `req.query` (default `60` if not provided — this is a sane default; the actual number needs client confirmation, see open point 2.7), calls the service, returns list.

### 2.6 Frontend (desktop)
New file `frontend/src/pages/crm/CrmImportCustomers.jsx`:
- File upload input (`.csv`, `.xlsx`), a "Preview" step is NOT required for v1 — direct upload + show result summary is enough (created/merged/skipped/error counts, and a small table of error rows with reasons).
- Calls new API function `importCustomers(file)` in `frontend/src/api/arnav/customers.js` (or wherever `findOrCreateCustomer`/`searchCustomers` already live — add alongside them), using `FormData` + `apiClient.post('/customers/import', formData, {headers:{'Content-Type':'multipart/form-data'}})`.

Update `frontend/src/pages/crm/CrmHome.jsx`:
- Add a new tab/section "Inactive Customers" (sibling to how `CrmPendingCredits.jsx` is surfaced — copy that pattern exactly: same tab-switch mechanism already in `CrmHome.jsx`).
- New file `frontend/src/pages/crm/CrmInactiveCustomers.jsx` modeled directly on `CrmPendingCredits.jsx`'s structure (list + filter + table markup) — fetch via new `getInactiveCustomers({thresholdDays})` API function, render a table: Name, Phone, Last Visit, Days Since Last Visit. Add a dropdown to switch threshold (30/45/60/90 days) that re-queries.
- Add a link/button "Import Customers" that routes to `CrmImportCustomers.jsx`.

Register both new pages in `frontend/src/routes/arnavRoutes.jsx` using `guardedRoute(path, importFn, {module:'crm', action:'view'})` for the alert page and `{module:'crm', action:'edit'}` for the import page — match whatever module/action `CrmHome.jsx` already uses (verify by opening the file's existing `usePermission` calls; do not guess a new module name).

### 2.6a Lazy load (tech-lead — locked; do not hydrate ~3000)
After the client Contacts seed (~3000 customers), **never** load the full collection into the browser.

- `GET /customers`: `page` + `pageSize` (default **`CUSTOMER_LIST_PAGE_SIZE=25`**, max **50**) → `{ items, total, page, pageSize, hasMore }`. Sort `name:1`. No unbounded `find()`.
- **CrmHome:** page 1 on mount; **Load more** (`crm-btn`) appends while `hasMore`. Toolbar total = API `total`, not `rows.length`.
- Search is server-side, resets to page 1 (debounce ~300ms). Do not client-filter a huge in-memory list.
- Inactive list uses the same page/`hasMore` pattern.
- POS + `CustomerSearchOrCreate` stay typeahead (`searchCustomers`, min 2 chars) — never list-all.
- WhatsApp offers must not receive a 3000-row `customers[]` — search or server audience query.
- Keep live `crm-table` / `crm-btn` styles. No new UI kit. No virtualizer library.
- Project rule: `.cursor/rules/crm-lazy-load.mdc`. Implementation continues in tracker Lazy load rows (constant → service → API → CrmHome → search → inactive/WhatsApp → test).

### 2.7 Open points — DO NOT silently decide these, use defaults below and flag for client sign-off

**Handover doc (tracker row 34):** [`docs/Feature-2-CRM-Client-Open-Points.md`](docs/Feature-2-CRM-Client-Open-Points.md) — share with client for sign-off.

- Inactive threshold default: **60 days** (`DEFAULT_INACTIVE_THRESHOLD_DAYS` in `crmAlertService.js`). Adjustable via API `threshold_days` and UI 30/45/60/90 — **client must confirm 60 is correct**.
- Import file columns: locked mapping for `Contacts-24-Aug-02-31.xlsx` in `backend/constants/customerImportConstants.js` + header aliases in `customerImportService.js`. **Client must confirm** future files use the same headers or provide an updated map.
- Mobile: v1 = desktop CRM only (owner/manager), per the spec's own recommendation. Do not build a mobile inactive-alert screen unless separately asked.

### 2.8 Test checklist
- Import a CSV with 5 rows: 2 new, 2 matching existing phone numbers (merge), 1 with missing phone (should land in `error_rows`, not crash the batch).
- Re-run the same file — the 2 "new" rows from before should now be detected as existing (by phone) and merged, not duplicated.
- A customer with a real S21 invoice 10 days ago should NOT show as inactive at a 60-day threshold, even if their imported `last_visit_date` was old.
- A customer with only an imported last-visit-date 100 days ago and no real invoice should show as inactive at 60-day threshold.
- A customer with no invoice and no imported date should show as inactive (never visited).

---

## FEATURE 3 — Family amount-based package (wallet)

### 3.1 What exists today
- `backend/models/PackageMaster.js`: `{name, type ('prepaid_bundle'|'membership'), validity_days, price, included_services, credit_count, discount_logic_json, branch_id, is_active}`.
- `backend/models/CustomerPackage.js`: `{customer_id, package_master_id, purchase_date, expiry_date, credits_remaining, status, invoice_id}` — one customer's purchased instance.
- Redemption logic: `backend/services/packageRedemptionService.js` → `batchValidatePackageRedemptions()`, called from `backend/controllers/billingController.js` during invoice creation. For `prepaid_bundle` it does `full_cover` (consumes 1 credit, line becomes ₹0); for `membership` it applies `discount_logic_json` (`{mode:'percentage'|'flat', value}`).
- Credits are decremented via `findOneAndUpdate` with `$inc` inside `billingService.createInvoice`'s transaction.
- POS UI: `frontend/src/pages/billing/PosScreen.jsx` — `getEligiblePackageForLine()` finds a redeemable package for the customer+item, toggles a paired ₹0 line with `package_redemption_id` set.

### 3.2 Schema changes

**`backend/models/PackageMaster.js`** — extend the `type` enum:
```js
type: { type: String, enum: ['prepaid_bundle', 'membership', 'amount_wallet'], required: true }
```
For `type: 'amount_wallet'`, reuse `price` as the purchase price (e.g. client pays ₹10,000) and add:
```js
wallet_value: { type: Number, default: null }  // the rupee balance credited on purchase; usually equals price but kept separate in case of bonus/promo top-ups (e.g. pay 9000, get 10000 balance)
```
`included_services`/`credit_count`/`discount_logic_json` stay `null`/unused for this type — do not repurpose them, keep the model self-documenting per type.

**`backend/models/CustomerPackage.js`** — add:
```js
wallet_balance: { type: Number, default: null },   // only set/used when package_master.type === 'amount_wallet'; mirrors credits_remaining's role but in rupees
linked_family_customer_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],  // members allowed to redeem this wallet besides the buyer
```
Keep `credits_remaining` untouched for the other two types — do not merge the two balance concepts into one field, that would make redemption logic ambiguous about units (credits vs rupees). Two parallel nullable fields is intentional and matches how `type` already discriminates behavior elsewhere in this codebase (see `discount_logic_json` being type-specific already).

### 3.3 Backend — family linking endpoints
Add to `backend/routes/packageRoutes.js` (the transactional package-sale routes, not `packageMasterRoutes.js`):
```js
router.post('/:customerPackageId/family-members', requirePermission('packages', 'edit'), asyncHandler(addFamilyMemberHandler));
router.delete('/:customerPackageId/family-members/:customerId', requirePermission('packages', 'edit'), asyncHandler(removeFamilyMemberHandler));
```
Handlers in a new/extended `backend/services/packageFamilyService.js`:
- `addFamilyMember(customerPackageId, customerId)`: loads the `CustomerPackage`, verifies `package_master.type === 'amount_wallet'`, verifies `customerId` exists in `Customer`, verifies not already linked, verifies not already the buyer, pushes to `linked_family_customer_ids`. Enforce a max count from a constant `MAX_WALLET_FAMILY_MEMBERS = 6` (placeholder — confirm with client per open point 3.6; keep it a named constant in `backend/constants/packageConstants.js` so it's a one-line change later, not scattered magic numbers).
- `removeFamilyMember(customerPackageId, customerId)`: pulls from the array. Do not block removal even if wallet has been partly used — removing just stops future redemption eligibility, it's not a financial reversal.

### 3.4 Backend — redemption logic change
In `backend/services/packageRedemptionService.js`:
- Extend `batchValidatePackageRedemptions()` / whatever function enumerates eligible packages for a customer+cart-line to also search: any `CustomerPackage` where `package_master.type === 'amount_wallet'` AND `status === 'active'` AND (`customer_id === cartCustomerId` OR `cartCustomerId` is in `linked_family_customer_ids`) AND `wallet_balance > 0` AND not expired.
- Pricing mode for `amount_wallet`: unlike `full_cover` (whole line free) or `discount_pct`/`flat_cover`, this is a **partial-or-full rupee deduction**:
  ```js
  const deduction = Math.min(lineTotal, customerPackage.wallet_balance);
  const remainingCharge = lineTotal - deduction; // >0 if wallet balance insufficient
  ```
  Add a new pricing mode constant, e.g. `'wallet_deduct'`, alongside the existing `full_cover`/`discount_pct`/`flat_cover` modes so `billingController`'s line-total recompute step has an explicit branch for it (mirror how it already branches on the existing modes — same `switch`/`if` structure, one more case).
- If `remainingCharge > 0`: per spec open point 3.6(b), default behavior = **customer pays the difference via the invoice's normal payment mode** (cash/UPI/card as selected) — do NOT reject the invoice. This matches the existing `split_payments` capability already in `Invoice.js`, so no new field is needed — the remaining charge just becomes part of the invoice's normal payable total.
- Inside `billingService.createInvoice`'s transaction, decrement `wallet_balance` via `findOneAndUpdate` with `$inc: {wallet_balance: -deduction}` — same atomic pattern already used for `credits_remaining`. If `wallet_balance` hits exactly 0, set `status: 'exhausted'` (mirror existing status-transition logic for `credits_remaining` reaching 0).
- GST: per spec open point 3.6(a), default = **GST applies at purchase (on the ₹10,000 sale), not again at redemption** (redemption lines show `tax_rate: 0` similar to how package-covered lines already do for `prepaid_bundle`). This mirrors the existing `prepaid_bundle` tax treatment (`resolveTax()` in `billingController.js` already returns 0% for package type items) — no new tax logic needed, just make sure `amount_wallet` line items get item_type `'package'` treatment in that same tax-resolution branch. Flag this default to the client per 3.6(a) below; if they want GST charged again on redemption, that's a one-line change in `resolveTax()`'s package branch (make it conditional on wallet type).

### 3.5 Frontend (desktop)
**Package Master (`frontend/src/pages/settings/packages/PackageMasterForm.jsx`):**
- Add `'amount_wallet'` as a third radio/select option alongside existing `prepaid_bundle`/`membership` type choices.
- When `amount_wallet` selected, show only relevant fields: `name`, `price`, `wallet_value` (default same as `price`, editable for bonus-balance promos), `validity_days`, `branch_id`, `is_active`. Hide `included_services`/`credit_count`/`discount_logic_json` fields (same conditional-rendering pattern the form must already use to switch between `prepaid_bundle` and `membership` field sets — extend that same switch, don't duplicate the form).

**Package sale (`frontend/src/pages/packages/PackageSale.jsx`):**
- After selling an `amount_wallet` package (creates the `CustomerPackage`), show a "Family Members" management panel: search-and-add existing `Customer` records (reuse the customer search component/API already used elsewhere, e.g. in `PosScreen.jsx`'s customer picker — check `arnavApi.searchCustomers`), or a "+ New family member" quick-create (reuse `findOrCreateCustomer` flow from POS).
- List currently linked members with a remove (✕) button, calling the new family-member endpoints from 3.3.

**Customer package list (`frontend/src/pages/packages/CustomerPackageList.jsx`):**
- For `amount_wallet` rows, display `wallet_balance` (formatted as ₹) instead of `credits_remaining`, and a small "Family: N members" chip. Clicking it opens the same family-management panel as above.

**POS (`frontend/src/pages/billing/PosScreen.jsx`):**
- `getEligiblePackageForLine()` needs to also match wallet packages linked to the current cart customer (as buyer or family member) — extend its existing customer-package-lookup query to include `linked_family_customer_ids` in the match, not just `customer_id`.
- When a wallet redemption is toggled on a line, show a deduction row (e.g. "Wallet applied: -₹450, remaining balance ₹9,550") instead of the flat "package covers this" chip used for `prepaid_bundle`. If `remainingCharge > 0` after wallet deduction, that amount stays in the line's payable total as normal (no special UI needed beyond showing the updated line price) — the checkout flow is otherwise unchanged.

### 3.6 Open points — flag for client sign-off, defaults are coded but must be confirmed
- **(a) GST timing** — coded default: GST at purchase only, redemption lines are 0% (matches existing `prepaid_bundle` treatment).
- **(b) Overspend** — coded default: customer pays the difference via normal payment mode, invoice never rejected.
- **(c) Max family members** — coded default: 6, as a named constant `MAX_WALLET_FAMILY_MEMBERS` in `backend/constants/packageConstants.js`. Members can be added/removed any time after sale (no lock-in).
- **(d) Refund/transfer of unused balance** — explicitly out of scope per spec section 7. Do not build a refund flow. If the client asks for it later, it's a separate feature (would need a manual "wallet adjustment" audit trail, not a build-now item).

### 3.7 Test checklist
- Sell an `amount_wallet` package of ₹10,000 to Customer A. Add Customer B (spouse) as family member.
- Customer B redeems a ₹450 service using the wallet at POS — wallet balance should become ₹9,550, invoice line shows ₹0 GST, line total ₹0 payable from wallet (or check ₹450 was deducted correctly).
- Redeem a service costing more than remaining balance (e.g. balance ₹200, service ₹500) — invoice should charge ₹300 via the selected payment mode, wallet balance goes to ₹0, status becomes `exhausted`.
- Remove Customer B from family — Customer B should no longer see this wallet as an eligible package at POS.
- Void the invoice from the ₹450 redemption — wallet balance should be restored to ₹10,000 (verify `billingService.voidInvoice()` is extended to reverse `wallet_balance` the same way it already reverses `credits_remaining`).

---

## FEATURE 4 — Service redo / rework (free for customer, product cost deducted from staff)

**Priority: build this last** — touches billing, inventory, and payroll together; most business rules need locking first (see 4.6). Build features 1–3 first so the billing/payroll seams are stable.

### 4.1 What exists today
- `backend/models/Invoice.js` / `InvoiceLineItem.js`: standard billing records, each line has `staff_id` (required), `item_type`, `quantity`, `unit_price`, `tax_amount`, etc.
- `backend/services/billingService.js createInvoice()`: the only path that creates invoices/lines, deducts stock (`stockService.deductStock`), and writes `CommissionEntry` rows.
- `backend/services/payrollService.js runPayrollForMonth()`: per-staff loop computes `working_days_in_month`, `unpaid_days`, `per_day_rate`, `deduction_amount`, `commission_total`, `net_payable = base_salary - deduction_amount + commission_total`. This loop is the seam where a new deduction type plugs in.
- `backend/models/ProductMaster.js`: has both `purchase_price` (cost) and `sale_price` — cost basis for the redo deduction is `purchase_price × qty_used`.
- `backend/services/stockService.js deductStock(productId, quantity, reason, {...})` — reasons enum already includes `damage`, `shrinkage` etc.; we'll add a new reason.

### 4.2 Schema changes

**New model `backend/models/RedoRequest.js`:**
```js
import mongoose from 'mongoose';
const RedoRequestSchema = new mongoose.Schema({
  original_invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  original_line_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceLineItem', required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  original_staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true },
  redo_staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile', required: true }, // staff who performs the redo (may equal original_staff_id)
  redo_invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },      // the ₹0 invoice created for the redo visit
  status: { type: String, enum: ['pending_approval', 'approved', 'rejected', 'completed'], default: 'pending_approval' },
  requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
  reason: { type: String, default: '' },
  products_used: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductMaster', required: true },
    quantity: { type: Number, required: true },
    cost_price_snapshot: { type: Number, required: true },  // purchase_price at time of redo, so payroll math is stable even if product cost changes later
    total_cost: { type: Number, required: true },           // quantity × cost_price_snapshot
  }],
  total_product_cost: { type: Number, default: 0 },          // sum of products_used[].total_cost, charged to redo_staff_id's payroll
  payroll_run_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null }, // set once this cost is pulled into a payroll run, for idempotency (mirrors CommissionEntry.payroll_run_id pattern)
}, { timestamps: true });
export default mongoose.model('RedoRequest', RedoRequestSchema);
```

**`backend/models/InvoiceLineItem.js`** — add optional linkage so a redo line is traceable back:
```js
redo_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RedoRequest', default: null }
```

**`backend/models/PayrollEntry.js`** — add:
```js
redo_product_cost_deduction: { type: Number, default: 0 }
```
Update `calculateNetPayable` usage in `payrollService.js` (see 4.5) to subtract this alongside the existing `deduction_amount`.

### 4.3 Backend — redo request flow
New file `backend/routes/redoRoutes.js`, mounted in `backend/routes/index.js` alongside the other `preciousRoutes`/`arnavRoutes` mounts (add it to whichever router file groups billing-adjacent routes — follow how `packageRoutes.js` is mounted).

Endpoints:
```js
router.post('/', requirePermission('billing', 'edit'), asyncHandler(createRedoRequestHandler));
router.get('/', requirePermission('billing', 'view'), asyncHandler(listRedoRequestsHandler));
router.get('/:id', requirePermission('billing', 'view'), asyncHandler(getRedoRequestHandler));
router.post('/:id/approve', requirePermission('payroll', 'edit'), asyncHandler(approveRedoRequestHandler));  // owner/manager-only approval gate, per spec's recommended control
router.post('/:id/reject', requirePermission('payroll', 'edit'), asyncHandler(rejectRedoRequestHandler));
router.post('/:id/complete', requirePermission('billing', 'edit'), asyncHandler(completeRedoRequestHandler));
```

New service `backend/services/redoService.js`:

**`createRedoRequest({originalLineItemId, redoStaffId, reason, requestedBy})`:**
1. Load `InvoiceLineItem` by id, must be `item_type: 'service'`. Load parent `Invoice` for `customer_id`.
2. Enforce redo window: `REDO_WINDOW_DAYS = 7` (constant in `backend/constants/redoConstants.js`, confirm exact number with client per 4.6(c) — keep it a single named constant). Reject with 400 if `Date.now() - invoice.billing_date > REDO_WINDOW_DAYS days`.
3. Enforce one-redo-per-line by default (per 4.6(e) default): reject if a `RedoRequest` already exists for this `original_line_item_id` with status not `rejected`.
4. Create `RedoRequest` with `status: 'pending_approval'`, `original_staff_id` = the line's existing `staff_id`, `redo_staff_id` = provided value (defaults to `original_staff_id` if not explicitly changed — per 4.6(a) default).
5. Return the created doc. **No invoice or stock changes happen yet** — that's gated behind approval (per spec's recommended control in section 5).

**`approveRedoRequest(id, approvedBy)`:**
1. Load `RedoRequest`, must be `pending_approval`. Set `status: 'approved'`, `approved_by`, `approved_at`.
2. Does NOT create the ₹0 invoice yet — that happens at `complete` time when front desk actually records the redo visit with products used (redo may be approved today, executed a few days later).

**`completeRedoRequest(id, {productsUsed})`** — `productsUsed: [{product_id, quantity}]`:
1. Load `RedoRequest`, must be `status: 'approved'`.
2. `withTransaction`:
   - For each `productsUsed` entry: load `ProductMaster`, snapshot `cost_price_snapshot = product.purchase_price`, `total_cost = quantity * cost_price_snapshot`. Call `stockService.deductStock(product_id, quantity, 'redo', {session, userId})` — **add `'redo'` to the `ADJUSTMENT_REASONS` enum in `stockService.js`** so this shows distinctly in `AuditLog`, don't overload an existing reason like `damage`.
   - Create a new `Invoice` for the redo visit: `payment_status: 'paid'`, `payment_mode: 'other'` (or add a dedicated mode if the client wants one — default `'other'` with a note field is fine for v1), totals all zero (`subtotal: 0, tax_total: 0, grand_total: 0, amount_paid: 0, amount_due: 0`), linked to the same `customer_id`.
   - Create one `InvoiceLineItem` on that invoice: `item_type: 'service'`, same `item_id`/`item_name` as the original, `quantity: 1`, `unit_price: 0`, `tax_amount: 0`, `total_amount: 0`, `staff_id: redo_staff_id`, `redo_request_id` = this request's id, `notes: 'Redo — no charge'`.
   - **Do NOT create a `CommissionEntry` for this ₹0 line** — commission is computed off `lineTotal` in the existing billing flow, and 0 naturally yields 0 commission if you reuse `calculateCommissionDetails`, but simplest/safest is to explicitly skip commission-entry creation for lines with `redo_request_id` set, so this doesn't depend on downstream math staying zero-safe forever.
   - Update `RedoRequest`: `products_used` = the snapshot array, `total_product_cost` = sum, `redo_invoice_id` = new invoice id, `status: 'completed'`.
3. This is the point where the product-cost liability is finalized and becomes visible to payroll (next section) — but it's only *pulled into* a specific payroll run when that run executes, same lazy-pull pattern as `CommissionEntry`.

### 4.4 Backend — inventory linkage
Handled inline in `completeRedoRequest` above via `stockService.deductStock(..., 'redo', ...)`. No separate inventory endpoint needed — this reuses the existing service exactly like `billingService.createInvoice` does for normal product sales.

### 4.5 Backend — payroll deduction plug-in
In `backend/services/payrollService.js`, inside `runPayrollForMonth()`'s per-staff loop (same place commission totals are summed), add:
```js
const redoDeduction = await RedoRequest.aggregate([
  {
    $match: {
      redo_staff_id: staff._id,
      status: 'completed',
      payroll_run_id: null, // not yet pulled into a prior run — idempotency guard, same pattern as CommissionEntry
      updatedAt: { $gte: monthStart, $lt: monthEnd }, // completed within this payroll month
    },
  },
  { $group: { _id: null, total: { $sum: '$total_product_cost' } } },
]);
const redoProductCostDeduction = redoDeduction[0]?.total || 0;
```
Then extend `calculateNetPayable`:
```js
// existing: net_payable = base_salary - deduction_amount + commission_total
net_payable = base_salary - deduction_amount + commission_total - redoProductCostDeduction;
```
Store `redoProductCostDeduction` on the `PayrollEntry` (`redo_product_cost_deduction` field from 4.2). After the run is created, mark all included `RedoRequest` docs with `payroll_run_id = payrollRun._id` — mirror exactly how `linkCommissionsToPayrollRun()` does it for `CommissionEntry`, ideally add a sibling function `linkRedoDeductionsToPayrollRun()` in the same file for consistency.

**Important:** if `finalizePayrollRun` can be re-run/regenerated in draft state (check existing behavior — `PayrollRun.status: 'draft'` implies re-computation is possible before finalize), make sure re-running `runPayrollForMonth` for the same month doesn't double-count already-linked `RedoRequest` docs — the `payroll_run_id: null` filter above already guards this the same way it's guarded for commissions, just make sure the "unlink on draft recompute" behavior (if it exists for commissions) is mirrored for redo deductions too. Check `runPayrollForMonth`'s existing draft-recompute handling first before assuming — read the function fully before writing this part.

### 4.6 Frontend (desktop)

**New page `frontend/src/pages/billing/RedoRequestForm.jsx`:**
- Accessible from `frontend/src/pages/billing/InvoiceDetail.jsx` — add a "Request Redo" button next to each `service`-type line item (only show for lines within the redo window, compute client-side from `invoice.billing_date` + the same `REDO_WINDOW_DAYS` — fetch this constant from a small `/redo/config` endpoint or hardcode matching the backend constant with a comment noting it must stay in sync; prefer exposing it via an endpoint so it's not duplicated in two places).
- Form: reason (text), redo staff (defaults to original staff, dropdown to change — matches 4.6(a) default below).
- Submits to new API `createRedoRequest` in `frontend/src/api/precious/redo.js` (new file, same thin-wrapper style).

**New page `frontend/src/pages/billing/RedoApprovals.jsx`** (owner/manager only, gated `payroll:edit` per the approval route's permission):
- List of `pending_approval` redo requests: customer, original service, original staff, redo staff, reason, requested date. Approve/Reject buttons.
- Register in `preciousRoutes.jsx` with `guardedRoute('/redo/approvals', ..., {module:'payroll', action:'edit'})`.

**New page `frontend/src/pages/billing/RedoComplete.jsx`** (front desk, once approved):
- List of `approved` redo requests awaiting completion. Clicking one opens a products-used entry form: product picker (reuse whatever product-select component `PosScreen.jsx` uses for adding product lines) + quantity, add multiple rows, submit calls `completeRedoRequest`.
- On success, show confirmation with the total product cost that will be deducted from the redo staff's next payroll.

Register all three pages in `frontend/src/routes/preciousRoutes.jsx` (this feature crosses billing/payroll which both live under `preciousRoutes.jsx` per the explore report — verify by checking where `PosScreen.jsx`/`RunPayroll.jsx` are currently registered and put these alongside).

**Payroll UI** — `frontend/src/pages/payroll/RunPayroll.jsx` and mobile `Earnings.jsx`: add a line item "Redo product cost deduction: -₹X" wherever `deduction_amount` and `commission_total` are already displayed per staff, so the net-payable breakdown stays transparent (copy the exact display pattern already used for the existing deduction line).

**Invoice history** — `frontend/src/pages/billing/InvoiceDetail.jsx`: for a line with `redo_request_id` set, show a badge "Redo of [original invoice #]" and link back to the original invoice, and on the *original* invoice's line, show "1 redo issued →" linking forward. This satisfies the spec's requirement that "the original paid visit and the free redo stay linked."

### 4.7 Open points — flag for client sign-off, defaults are coded but must be confirmed
- **(a) Which staff is deducted** — coded default: deduction always goes to `redo_staff_id` (the one who actually performs the redo), which defaults to the original staff but is editable at request time. This directly answers spec question 5(a) by making it a per-request choice rather than a fixed rule.
- **(b) Cost basis** — coded default: `ProductMaster.purchase_price` (cost/purchase price, not `sale_price`), snapshotted at redo-completion time so later price changes don't retroactively affect an already-completed redo's payroll math.
- **(c) Redo window** — coded default: 7 days, as named constant `REDO_WINDOW_DAYS` in `backend/constants/redoConstants.js`. One-line change once confirmed.
- **(d) Service-only redo (no products) still free, no salary cut** — this falls out naturally: if `productsUsed` is empty, `total_product_cost` = 0, no payroll deduction occurs, but the ₹0 invoice/history-link still gets created. No special-case code needed.
- **(e) One redo per original bill line** — coded default: enforced (see 4.3 step 3). If the client wants multiple redos allowed per line, remove that one guard clause — flag this as the easiest of the open points to change later.

### 4.8 Test checklist
- Create a redo request for a service line billed 3 days ago → should succeed (within window). Try one for a line billed 10 days ago → should be rejected (past `REDO_WINDOW_DAYS`).
- Try creating a second redo request for the same line after the first is `approved`/`completed` → should be rejected (one-redo-per-line default).
- Approve a request, then complete it with 2 products used (e.g. 30ml + 15ml of two different products) → verify: stock deducted for both products with `AuditLog` reason `'redo'`, a new ₹0 invoice created and linked, `RedoRequest.total_product_cost` = correct sum using `purchase_price`.
- Run payroll for the month the redo was completed in → redo staff's `PayrollEntry.redo_product_cost_deduction` should equal that sum, and `net_payable` should reflect the subtraction.
- Re-run payroll for the same month (draft recompute) → the deduction must NOT double — verify the `payroll_run_id: null` guard prevents re-summing an already-linked `RedoRequest`.
- Reject a pending request → no invoice, no stock change, no payroll impact should occur.

---

## Build order (matches the client-facing spec's own recommendation)

1. **Feature 1** — Per-employee late-mark buffer (section above). Isolated, low risk, ships first.
2. **Feature 2** — Customer import + inactive alert. CRM-only, no billing/payroll coupling.
3. **Feature 3** — Family amount-based package. Touches Package Master + POS + billing transaction.
4. **Feature 4** — Redo/rework. Crosses billing, inventory, and payroll — build last, once 1–3 have proven out the pattern and any shared utilities (constants files, redo/family UI patterns) are already in place.

Do not start Feature 4 until the specific open points in section 4.7 are confirmed by the client — the constants are coded with defaults so development isn't blocked, but payroll deduction logic is the highest-risk area (real money on staff paychecks) and should not ship on assumptions.
