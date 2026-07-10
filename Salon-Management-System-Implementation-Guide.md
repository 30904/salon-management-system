# Salon Management System — Implementation Guide
**Client:** Chaitanya referral — existing salon needing full system (Web + Mobile)
**Prepared by:** Heramb / Celeris Venture Systems
**Structure standard:** Settings/Masters → Transactions → Reports (per Celeris SOP)
**UI standard:** Clean minimal, collapsible left-nav module list (reference: Celeris ERP / AIMS platform UI)

---

## 0. Scope Confirmed With Heramb (pre-client-meeting assumptions — validate with client)

| Decision | Answer |
|---|---|
| Tech stack | MERN (React .jsx frontend, Node/Express .js backend, MongoDB) — mobile via PWA, not native |
| Branch structure | Single branch only (design DB schema to allow multi-branch later without rework — don't hardcode single-location assumptions) |
| Retail product sales | Yes — services + retail products, so POS must deduct stock on product sale |
| Staff commission | Yes — threshold-bonus model (5x monthly sales of salary → 10% salary bonus), fully configurable via admin UI — see Technical Spec Section 4 |
| Roles | 4 roles defined as build step zero: Owner/CEO, Manager, Stylist, Massage/Spa Therapist — see Technical Spec Section 1 |
| Bookings | Both online (customer-facing) and internal — **build internal front-desk booking first**, customer-facing online booking is Phase 2 |
| Packages | Both types — (a) prepaid bundles (buy 2 get 1, credit-based redemption) AND (b) subscription/membership (monthly unlimited or capped) |
| CRM scope | Visit history + preferences AND marketing automation — automated WhatsApp campaigns (birthday, anniversary, Mother's Day, festival offers etc.) |
| Attendance | Punch-in/punch-out based (confirmed) |

---

## 1. Module List (from client's handwritten notes + our standard structure)

**Build order note:** Roles (Owner/CEO, Manager, Stylist, Massage/Spa Therapist) and permissions are step zero — set up before any feature module. Full spec in the companion Technical Build Spec doc.

1. Inventory Management
2. CRM
3. Invoices
4. Punch-In Attendance
5. Payroll
6. Customer Tracking
7. Bookings
8. Packages
9. Employees

Mapped into our Settings/Masters → Transactions → Reports pattern below.

---

## 2. Module-by-Module Breakdown

### 2.1 Masters/Settings (set up once, rarely changed)
- **Service Master** — service name, category (hair/skin/spa/bridal etc.), duration, price, applicable commission %
- **Product Master** — retail product name, SKU, purchase price, sale price, stock unit, reorder level
- **Staff Master** — name, role/designation, service specialization mapping, commission slab, salary structure, shift timing
- **Package Master** — define package type (Prepaid Bundle vs Membership), included services/products, validity period, price, discount logic (e.g. "buy 2 get 1 free" = 3 credits for price of 2)
- **Customer Master** — auto-created on first visit; fields: name, phone, DOB, anniversary date, preferences (preferred stylist, allergies, preferred services), tags
- **Tax/GST Master** — applicable tax rates for services vs products (may differ)
- **WhatsApp Template Master** — pre-approved message templates for automated campaigns (birthday, anniversary, festival, package expiry reminder, appointment reminder)
- **Shift/Attendance Rules Master** — working hours, late-mark threshold, leave types

### 2.2 Transactions (daily operational entries)

**Bookings/Appointments**
- Internal (Phase 1): front-desk staff creates booking — select customer (or quick-add new), service(s), preferred stylist, date/time slot
- Slot/stylist availability check (avoid double-booking a stylist)
- Status flow: Booked → Confirmed → In Progress → Completed → No-show/Cancelled
- Phase 2 (flagged, not built now): customer self-booking via app/web, syncs into same slot engine

**Billing/Invoice (POS)**
- Line items: services rendered + retail products sold, in one invoice
- Auto stock deduction on product sale
- Package redemption at billing — if customer has active package, deduct credit/session instead of charging, or apply membership discount automatically
- Payment modes: cash, UPI, card — split payment support
- Auto-generates commission entry per staff member per service line (feeds Payroll)
- GST-compliant invoice format

**Attendance**
- Punch-in / punch-out (confirmed requirement)
- Recommend: simple web-based punch (staff login on shared tablet/device) for MVP — biometric/face recognition can be Phase 2 (note: Celeris already has InsightFace-based attendance from HRMS work — reusable if client wants that upsell later)
- Daily attendance feeds directly into Payroll calculation

**Customer Visit Log**
- Auto-created from each completed booking/invoice — visit date, services taken, staff assigned, amount spent, feedback/rating (optional)
- This is the data source for CRM segmentation (e.g. "customers who haven't visited in 60 days")

**Package Sale/Redemption**
- Sale: customer buys package (prepaid or membership), master validity/credits assigned
- Redemption: tracked against each invoice until credits exhausted or validity expires
- Auto-alert (WhatsApp) when package nearing expiry or low on credits — ties into CRM automation

### 2.3 CRM / Marketing Automation Module (this is the differentiator — build it well)
- Segment customers automatically: birthday this week, anniversary this month, inactive 45+/60+ days, high-value customers, package expiring soon
- WhatsApp automation triggers (use WhatsApp Business API, not just click-to-chat like the saree project — this genuinely needs the API since it's automated/scheduled, not manual):
  - Birthday/anniversary greeting + offer
  - Festival campaigns (Mother's Day etc. — client specifically mentioned this)
  - Appointment reminders (day before, few hours before)
  - Package expiry/low-credit nudges
  - Win-back campaign for inactive customers
- **Important dev note:** WhatsApp Business API (not just Business app) is required for scheduled/automated outbound messages at scale — this has approval lead time and per-message cost (Meta pricing). Flag this to me — it affects both timeline and the pricing quote, this is NOT the same lightweight WhatsApp catalog we're doing for the saree project.

### 2.4 Payroll
- Base salary (from Staff Master) + commission earned (from Billing) + attendance-based deductions (late/absent per Attendance Rules) = net payroll
- Monthly payroll run, exportable (Excel/PDF) for accountant

### 2.5 Reports (this is where a "flat on the menu" dashboard experience needs to happen)
- Daily/Monthly Revenue (services vs products split)
- Staff Performance (services done, revenue generated, commission earned — leaderboard style)
- Attendance Summary
- Inventory Stock/Reorder Report
- Customer Retention Report (repeat vs new, churn/inactive list)
- Package Sales & Redemption Report
- Campaign Performance Report (WhatsApp open/response if API provides it)

---

## 3. Dashboard — This Needs to Be the Showstopper

Client brief: "should be absolutely insane, I want the user to get flat looking at the menu and dashboard itself."

Reference the AIMS/Celeris ERP dashboard style from our existing platforms — executive-cockpit feel, not a bare admin panel. Build toward:
- Hero greeting strip (like "Good morning, [Name]" banners we already use) with a business-health style score if feasible
- Top KPI cards: Today's Revenue, Today's Bookings, Walk-ins vs Appointments, Pending Approvals/Low Stock Alerts, Active Packages, Staff on Duty
- Visual charts: Revenue trend, Service-category split, Staff performance leaderboard, Booking funnel (booked → completed → no-show)
- Make it colorful, confident, data-dense but clean — this single screen is a major part of what sells the "wow" factor to a non-technical salon owner

Left nav: collapsible, module icons + labels, matches our standard ERP shell pattern (Dashboard → Bookings → Billing → CRM → Inventory → Attendance → Payroll → Employees → Reports → Settings).

---

## 4. Critical UX Principle (client's exact words: keep it dead simple to operate)

- The person operating this day-to-day is a **salon receptionist/owner, not a technical user.** Every transaction screen (booking, billing, attendance punch) must be completable in the fewest possible taps/clicks — no jargon, no unnecessary fields, large touch targets if tablet-based.
- Complexity (reports, campaign automation, package logic) lives in the backend/admin views — the daily-use screens (booking, billing, punch) must stay dead simple regardless of how much power is under the hood.
- Recommend a large touchscreen-friendly POS/booking UI as the default view for front-desk staff, with the "insane" analytical dashboard reserved for the owner/admin login.

---

## 5. Tech/Architecture Notes for Dev

- **Stack (fixed):** MERN — React (.jsx) frontend, Node/Express (.js) backend, MongoDB. Mobile via PWA (installable, add-to-homescreen), not a native build.
- Web + PWA mobile both required, single responsive React codebase — design mobile-first/responsive from day one so the PWA wrap is trivial rather than retrofitted.
- Design schema now for multi-branch even though single-branch today — client may expand, and retrofitting branch references later is painful
- WhatsApp Business API integration needs earlier planning than other modules due to Meta approval lead time — start this application process in parallel with other dev work, don't leave it till the end
- Reuse patterns from existing Celeris HRMS (attendance/payroll, already built with punch and face-recognition options) and ERP platform (dashboard/module shell) rather than building from scratch — this is a major cost/time advantage we have over a generic dev agency quoting this from zero
- Full technical detail (data model, screens, commission engine, RBAC spec) is in the companion Technical Build Spec document — this guide stays at the scoping level.

---

## 6. Open Items to Confirm With Client at Meeting

- Exact service list & current pricing (for Service Master seed data)
- Does she currently use any system at all, or fully manual/register-based? (migration effort depends on this)
- Number of staff/stylists currently employed (affects commission/payroll complexity estimate)
- Does she want the customer-facing booking app in Phase 1 or is internal-only truly fine to start? (confirmed assumption: internal first, but validate)
- WhatsApp number — new dedicated business number or existing one she already uses for the salon?
