# HR Domain Audit Report

**Project:** S21 Management (Salon Management System)  
**Date:** August 7, 2026  
**Purpose:** Pre-build audit for **Leave Clash Detection + Salary Deduction + Leave Swap** feature  
**Scope:** Employee, Leave, Attendance, Weekly Off, Designation/Role, Salary/Payroll

---

## Executive Summary

| Area | Current State |
|------|---------------|
| **Employee records** | Implemented via `StaffProfile` + linked `User` |
| **Attendance (punch in/out)** | Implemented — geofenced punch, daily records, monthly summary |
| **Leave requests / apply-leave** | **Not implemented** — no model, API, or UI |
| **Leave approval workflow** | **Not implemented** |
| **Weekly off** | **Frontend-only** — hardcoded Sunday (UTC); not stored in DB |
| **Designation** | Free-text string on `StaffProfile` (one per employee) |
| **RBAC Role** | Separate enum-backed `Role` model on `User` (not the same as designation) |
| **Payroll / salary deduction** | **Partial** — `base_salary` stored; payable-days counted; no deduction engine or payroll runs |
| **Leave swap / clash detection** | **Not implemented** |

---

## 1. DATABASE / MODELS

**Database:** MongoDB  
**ODM:** Mongoose 8  
**Timestamps:** All schemas use `{ timestamps: true }` → auto `createdAt`, `updatedAt`

### Models That Exist

#### 1.1 `StaffProfile` — Employee profile (primary employee record)

**File:** `backend/models/StaffProfile.js`  
**Collection:** `staffprofiles`

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | `ObjectId` → `User` | required, unique index |
| `designation` | `String` | required, trim, indexed |
| `specialization` | `[String]` | default `[]` |
| `commission_slab_id` | `ObjectId` → `CommissionSlab` | default `null` |
| `base_salary` | `Number` | default `0`, min `0` |
| `monthly_target_1` | `Number` | default `0`, min `0` |
| `monthly_target_2` | `Number` | default `0`, min `0` |
| `shift_id` | `ObjectId` → `ShiftMaster` | default `null` |
| `joining_date` | `Date` | default `null` |
| `is_active` | `Boolean` | default `true` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Indexes:** `{ user_id: 1 }` unique, `{ is_active: 1 }`, `{ designation: 1 }`

---

#### 1.2 `User` — Login account linked to staff

**File:** `backend/models/User.js`  
**Collection:** `users`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | required, trim, maxlength 120 |
| `phone` | `String` | required, trim |
| `email` | `String` | trim, lowercase, default `null` |
| `password_hash` | `String` | required, `select: false` |
| `role_id` | `ObjectId` → `Role` | required (RBAC, not job designation) |
| `branch_id` | `ObjectId` → `Branch` | default `null` |
| `is_active` | `Boolean` | default `true` |
| `created_by` | `ObjectId` → `User` | default `null` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Indexes:** `{ branch_id, phone }` unique, `{ email }` unique sparse, `{ role_id, is_active }`, `{ is_active }`

---

#### 1.3 `Attendance` — Daily punch / status records

**File:** `backend/models/Attendance.js`  
**Collection:** `attendances`

| Field | Type | Notes |
|-------|------|-------|
| `staff_id` | `ObjectId` → `StaffProfile` | required |
| `date` | `Date` | required (normalized to UTC midnight) |
| `punch_in_time` | `Date` | default `null` |
| `punch_out_time` | `Date` | default `null` |
| `status` | `String` | enum, default `"present"`, required |
| `remarks` | `String` | trim, default `""` |
| `punched_by` | `ObjectId` → `User` | default `null` (manager punching on behalf) |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Status enum (`ATTENDANCE_STATUSES`):**  
`present` | `absent` | `half_day` | `on_leave` | `late`

**Indexes:** `{ staff_id, date }`, `{ date, status }`

> **Note:** There is no `leave_type`, `weekly_off`, or `leave_status` field on this model. Leave is represented only as the attendance status `on_leave`.

---

#### 1.4 `AttendanceRule` — Late-mark and leave-type config (unused at runtime)

**File:** `backend/models/AttendanceRule.js`  
**Collection:** `attendancerules`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | required, trim |
| `late_mark_minutes` | `Number` | default `15`, min `0` |
| `leave_types` | `Mixed` | default `[]` — **unstructured JSON, no sub-schema** |
| `branch_id` | `ObjectId` → `Branch` | default `null` |
| `is_active` | `Boolean` | default `true` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Indexes:** `{ branch_id, name }` unique, `{ is_active }`

> **Important:** Routes exist (`attendanceRuleRoutes.js`) but are **not mounted** in `preciousRoutes.js`. No consumer reads `leave_types` today.

---

#### 1.5 `Role` — RBAC system role (not job designation)

**File:** `backend/models/Role.js`  
**Collection:** `roles`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | required, unique, enum |
| `description` | `String` | trim, default `""` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Name enum (`ROLE_NAMES`):**
- `Owner/CEO`
- `Manager`
- `Stylist`
- `Massage/Spa Therapist`

---

#### 1.6 `RolePermission` — Role ↔ Permission join

**File:** `backend/models/RolePermission.js`  
**Collection:** `rolepermissions`

| Field | Type | Notes |
|-------|------|-------|
| `role_id` | `ObjectId` → `Role` | required |
| `permission_id` | `ObjectId` → `Permission` | required |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Indexes:** `{ role_id, permission_id }` unique, `{ role_id }`, `{ permission_id }`

---

#### 1.7 `Permission` — Module-level RBAC

**File:** `backend/models/Permission.js`  
**Collection:** `permissions`

| Field | Type | Notes |
|-------|------|-------|
| `module` | `String` | enum, required |
| `action` | `String` | enum, required |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Module enum includes:** `attendance`, `payroll`, `employees`, `dashboard`, `bookings`, `billing`, `crm`, `inventory`, `reports`, `settings`, `users`, `audit_logs`

**Action enum:** `view` | `create` | `edit` | `delete` | `approve`

---

#### 1.8 `ShiftMaster` — Work shift schedule

**File:** `backend/models/ShiftMaster.js`  
**Collection:** `shiftmasters`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | required, trim |
| `start_time` | `String` | required, `HH:MM` 24h regex |
| `end_time` | `String` | required, `HH:MM` 24h regex |
| `branch_id` | `ObjectId` → `Branch` | default `null` |
| `is_active` | `Boolean` | default `true` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

---

#### 1.9 `StaffMonthlyTarget` — Per-month sales target overrides

**File:** `backend/models/StaffMonthlyTarget.js`  
**Collection:** `staffmonthlytargets`

| Field | Type | Notes |
|-------|------|-------|
| `staff_id` | `ObjectId` → `StaffProfile` | required |
| `month` | `Number` | required, 1–12 |
| `year` | `Number` | required, 2000–2100 |
| `target_1_amount` | `Number` | required, min `0` |
| `target_2_amount` | `Number` | required, min `0` |
| `notes` | `String` | default `null`, trim |
| `set_by` | `ObjectId` → `User` | default `null` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**Indexes:** `{ staff_id, year, month }` unique

---

#### 1.10 `CommissionEntry` — Commission accrual (payroll-adjacent)

**File:** `backend/models/CommissionEntry.js`  
**Collection:** `commissionentries`

| Field | Type | Notes |
|-------|------|-------|
| `staff_id` | `ObjectId` → `StaffProfile` | required |
| `invoice_line_item_id` | `ObjectId` → `InvoiceLineItem` | default `null` |
| `commission_slab_id` | `ObjectId` → `CommissionSlab` | default `null` |
| `slab_type` | `String` | enum, default `"none"` |
| `commission_amount` | `Number` | required, min `0`, default `0` |
| `status` | `String` | enum, default `"accrued"` |
| `calculated_at` | `Date` | required, default now |
| `payroll_run_id` | `ObjectId` → **`PayrollRun`** | default `null` — **model does not exist** |
| `service_label` | `String` | trim, default `null` |
| `invoice_reference` | `String` | trim, default `null` |
| `line_amount` | `Number` | default `0`, min `0` |
| `calculation_details_json` | `Mixed` | default `{}` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**`slab_type` enum:** `percentage` | `flat` | `tiered` | `threshold` | `manual_override` | `none`  
**`status` enum:** `accrued` | `deferred_threshold` | `paid` | `cancelled`

---

#### 1.11 `CommissionSlab` — Commission rule definitions

**File:** `backend/models/CommissionSlab.js`  
**Collection:** `commissionslabs`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | required, trim, unique |
| `type` | `String` | enum, default `"percentage"` |
| `rules_json` | `Mixed` | default `{}` |
| `is_active` | `Boolean` | default `true` |
| `createdAt` | `Date` | auto |
| `updatedAt` | `Date` | auto |

**`type` enum:** `percentage` | `flat` | `tiered` | `threshold`

---

### Models That Do NOT Exist

| Planned Model | Status | Reference |
|---------------|--------|-----------|
| `Employee` | Not needed — `StaffProfile` is the employee record | — |
| `LeaveRequest` / `Leave` | **Missing** | Would need to be built |
| `PayrollRun` | **Missing** | Referenced by `CommissionEntry.payroll_run_id`; planned in `implementation-tracker-csv/06_Attendance-Payroll.csv` |
| `PayrollEntry` | **Missing** | Planned: `base_salary`, `commission_total`, `deductions`, `net_payable` |
| `Designation` (master table) | **Missing** | Designation is free-text on `StaffProfile` |
| `WeeklyOff` | **Missing** | Hardcoded in frontend only |

---

### Field Existence Checklist

| Concept | Exists? | Where |
|---------|---------|-------|
| **Weekly off day** | Partial | Frontend only: `isWeeklyOffDay()` → Sunday UTC. Not in DB. UI status `"weekly_off"` is derived, not stored. |
| **Leave type** | Stub only | `AttendanceRule.leave_types` (`Mixed`, unstructured). Not wired to any logic. |
| **Leave status** | Partial | `Attendance.status = "on_leave"` only. No pending/approved/rejected leave workflow. |
| **Designation** | Yes | `StaffProfile.designation` — free-text `String`, one per employee. |

---

## 2. EXISTING LEAVE LOGIC

### 2.1 Leave Request / Apply-Leave Flow

**None exists.** There is no:
- `LeaveRequest` model or collection
- `/api/leave` or `/apply-leave` endpoint
- Apply-leave UI page or form
- Leave calendar or quota tracking

### 2.2 Closest Existing Behaviors

| Behavior | File(s) | Function / Handler | Description |
|----------|---------|-------------------|-------------|
| Mark day as on leave | `backend/routes/attendanceRoutes.js` | `POST /punch-in` handler | Accepts optional `status` in body; can set `"on_leave"` at punch-in |
| Attendance status display | `frontend/src/pages/precious/attendanceUtils.js` | `statusLabel()`, `resolveDayStatus()` | UI label "On Leave" for `on_leave`; `"Weekly Off"` derived for Sundays |
| Leave type config (unused) | `backend/models/AttendanceRule.js` | schema field `leave_types` | JSON blob — no API mount, no consumer |
| Attendance rule CRUD (unmounted) | `backend/routes/attendanceRuleRoutes.js` | `GET/POST/PUT/DELETE /` | Full CRUD exists but route not registered |

### 2.3 Attendance Flow (What IS Implemented)

```
Frontend/Mobile
  → POST /api/attendance/punch-in  (optional: status, remarks, latitude, longitude)
  → POST /api/attendance/punch-out
  → GET  /api/attendance/status      (open punch check)
  → GET  /api/attendance/today       (live dashboard)
  → GET  /api/attendance/summary     (monthly payroll-oriented counts)
  → GET  /api/attendance             (list with filters)
```

**Key backend helpers** (`attendanceRoutes.js`):
- `formatAttendanceResponse`
- `getNormalizedDate`
- `resolveTargetStaff`
- `assertWithinPunchGeofence`
- `isPunchingOnBehalf`
- `resolveBranchForStaff`

**Frontend API client:** `frontend/src/api/precious/attendanceApi.js`  
**Mobile:** `frontend-mobile/src/api/attendanceApi.js`, `frontend-mobile/src/pages/Attendance.jsx`

### 2.4 Approval Workflow

**No leave approval workflow exists.**

| Context | Status Values | Location |
|---------|---------------|----------|
| Attendance UI (not punched) | `"Pending"` label for `not_punched_in` | `attendanceUtils.js` → `statusLabel()` |
| Commission entries | `accrued`, `deferred_threshold`, `paid`, `cancelled` | `CommissionEntry.js` |
| RBAC permission catalog | `approve` action defined | `Permission.js`, `permissionCatalog.js` |
| Bookings | `upcoming`, `completed`, `cancelled` | booking services — unrelated to leave |

There is no `pending` / `approved` / `rejected` state machine for leave.

### 2.5 Salary Deduction Logic

**No salary deduction engine is implemented.**

What exists today:

#### Payable-days formula (`GET /api/attendance/summary`)

```javascript
payableDays = daysPresent + daysLate + (daysHalfDay * 0.5)
```

- `days_on_leave` and `days_absent` are **counted and returned** but **not subtracted** from payable days
- `base_salary` is returned per staff member
- **No `net_payable`, `deduction_amount`, or proration calculation**

**File:** `backend/routes/attendanceRoutes.js` (lines ~361–382)

#### Reports snapshot (same formula)

```javascript
payable = present + late + (half_day count * 0.5)
```

**File:** `backend/services/reportsService.js` → `aggregateAttendanceSnapshot()`

#### Broken deduction simulator (frontend stub)

`frontend/src/pages/settings/attendance/ShiftList.jsx` references `evaluateDeduction({ shift_id, punch_time })` but:
- Function is **not imported**
- Supporting state variables are **undefined**
- **No backend endpoint** exists for deduction evaluation

#### Staff targets (salary-linked, not deduction)

`backend/services/staffTargetsService.js` uses `base_salary × 5` and `× 7` as default monthly sales targets — unrelated to attendance deductions.

#### Planned (not built)

From `implementation-tracker-csv/06_Attendance-Payroll.csv`:
> `payrollService.js` — base + commission + **attendance deductions from Precious's summary API**

---

## 3. DESIGNATION / ROLE SYSTEM

### 3.1 Two Separate Concepts

| Concept | Storage | Purpose | Example Values |
|---------|---------|---------|----------------|
| **Designation** (job title) | `StaffProfile.designation` — free-text `String` | What the person does at the salon | "Senior Stylist", "Beautician", "Colorist" |
| **Role** (RBAC) | `User.role_id` → `Role.name` — fixed enum | System permissions / access level | "Owner/CEO", "Manager", "Stylist", "Massage/Spa Therapist" |

These are **independent**. A user with RBAC role `Stylist` can have designation `"Senior Beautician"`.

### 3.2 How Designation Is Stored

- **Type:** Free-text string field on `StaffProfile`
- **Not** a separate master table
- **Not** a fixed enum (unlike RBAC `Role`)
- **Required** on staff create/update
- **Indexed** for filtering (`GET /api/staff?designation=...`)
- **UI:** Text input with placeholder `"e.g. Senior Stylist, Colorist"` — `StaffForm.jsx`

### 3.3 Multiple Designations

**One designation per employee.**  
`StaffProfile` has a single `designation` field. There is no array, join table, or history of designations.

`specialization` (`[String]`) allows multiple skill tags (e.g. `"Hair Coloring"`, `"Keratin"`) but this is not the same as designation.

### 3.4 Seed Data Examples

From `backend/seeds/seedRealStaff.js`:
- Senior Stylist, Junior Stylist, Stylist
- Senior Beautician, Junior Beautician, Beautician

---

## 4. DATE / WEEK HANDLING

### 4.1 Date Library

**Native JavaScript `Date` only.** No moment, dayjs, date-fns, or luxon in backend or frontend dependencies.

Common patterns:
- UTC normalization: `Date.UTC(...)`, `getUTCFullYear()`, `getUTCMonth()`, `toISOString().slice(0, 10)`
- Local helpers: `startOfDay`, `endOfDay`, `addDays` in `dashboardService.js`
- Frontend: `toLocaleDateString`, manual `HH:MM` parsing in `attendanceUtils.js`

### 4.2 Week Concepts

| Concept | Exists? | Implementation |
|---------|---------|----------------|
| Weekly off day | Yes (frontend) | `isWeeklyOffDay(dateObj)` → `dateObj.getUTCDay() === 0` (Sunday, UTC) |
| Rolling 7-day window | Yes (dashboard) | `weekStart = startOfDay(addDays(new Date(), -6))` — not ISO week |
| Calendar month boundaries | Yes | UTC month via `Date.UTC(year, month-1, 1)` |
| ISO week number | **No** | Not used anywhere |
| Configurable week start day | **No** | Sunday is hardcoded |
| Per-employee weekly off | **No** | Same Sunday rule for all staff |

**Weekly off resolution** (`frontend/src/pages/precious/attendanceUtils.js`):

```javascript
export function isWeeklyOffDay(dateObj) {
  return dateObj.getUTCDay() === 0;
}

export function resolveDayStatus({ record, dateObj }) {
  if (record?.status) return record.status;
  if (isWeeklyOffDay(dateObj)) return "weekly_off";
  return "absent";
}
```

> `"weekly_off"` is a **UI-derived status** only. It is not in `ATTENDANCE_STATUSES` and is never persisted to MongoDB.

### 4.3 Attendance Date Normalization

`getNormalizedDate()` in `attendanceRoutes.js` normalizes all attendance dates to **UTC midnight**:

```javascript
return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
```

---

## 5. TECH STACK

### Backend

| Component | Technology |
|-----------|------------|
| Language | JavaScript (ES modules) |
| Framework | Express 4.21 |
| Database | MongoDB (via `MONGO_URI`) |
| ODM | Mongoose 8.9 |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Other | cors, dotenv |

**Entry point:** `backend/server.js`

### Frontend (Web)

| Component | Technology |
|-----------|------------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | react-router-dom 7 |
| HTTP client | axios |
| Charts | chart.js + react-chartjs-2 |
| PWA | vite-plugin-pwa |

**Attendance UI:** `frontend/src/pages/precious/AttendanceHome.jsx`  
**Payroll UI:** `frontend/src/pages/payroll/` (mostly placeholder)  
**Staff settings:** `frontend/src/pages/settings/staff/`

### Frontend (Mobile PWA)

| Component | Technology |
|-----------|------------|
| Location | `frontend-mobile/` |
| Attendance | `frontend-mobile/src/pages/Attendance.jsx` |
| Earnings | `frontend-mobile/src/pages/Earnings.jsx` |

### API Route Organization

- **Precious modules** (attendance, staff, shifts): `backend/routes/preciousRoutes.js` → mounted at `/api`
- **Arnav modules** (auth, bookings, reports, planned payroll): `backend/routes/arnavRoutes.js` → mounted at `/api`

---

## 6. FILE STRUCTURE

Backend HR-relevant structure (3 levels deep):

```
backend/
├── models/
│   ├── Attendance.js
│   ├── AttendanceRule.js
│   ├── CommissionEntry.js
│   ├── CommissionSlab.js
│   ├── Permission.js
│   ├── Role.js
│   ├── RolePermission.js
│   ├── ShiftMaster.js
│   ├── StaffMonthlyTarget.js
│   ├── StaffProfile.js
│   └── User.js
├── routes/
│   ├── attendanceRoutes.js          ← punch in/out, summary (inline handlers)
│   ├── attendanceRuleRoutes.js      ← CRUD exists, NOT mounted
│   ├── commissionSlabRoutes.js
│   ├── preciousRoutes.js            ← mounts /attendance, /staff, /shifts
│   ├── arnavRoutes.js               ← planned /payroll (comment only)
│   ├── shiftRoutes.js
│   └── staffRoutes.js
├── controllers/
│   ├── staffCalendarController.js   ← getMyCalendarHandler
│   ├── staffEarningsController.js   ← getMyEarningsHandler
│   ├── staffTargetsController.js    ← getMyTargetsHandler, upsertStaffTargetsHandler
│   └── reportsController.js         ← owner reports incl. attendance snapshot
├── services/
│   ├── staffCalendarService.js
│   ├── staffEarningsService.js
│   ├── staffTargetsService.js
│   └── reportsService.js            ← aggregateAttendanceSnapshot
└── seeds/
    ├── testAttendanceModels.js
    ├── testAttendancePunchApi.js
    ├── testStaffMaster.js
    ├── testStaffEarnings.js
    ├── demoStaffEarningsSeed.js
    ├── demoStaffShiftSeed.js
    ├── seedRealStaff.js
    └── syncStaffTargetsSeed.js
```

Frontend HR-relevant structure:

```
frontend/src/
├── api/
│   ├── precious/
│   │   └── attendanceApi.js
│   ├── shiftAndRulesApi.js          ← shifts only, no rules API
│   └── staffApi.js
├── pages/
│   ├── precious/
│   │   ├── AttendanceHome.jsx       ← main attendance UI
│   │   └── attendanceUtils.js       ← weekly off, status labels
│   ├── payroll/
│   │   ├── PayrollHome.jsx          ← static placeholder
│   │   ├── CtcStructure.jsx         ← staff salary table
│   │   └── RunPayroll.jsx           ← empty state
│   ├── settings/
│   │   ├── attendance/
│   │   │   ├── AttendanceMasterHome.jsx
│   │   │   └── ShiftList.jsx        ← broken deduction simulator
│   │   └── staff/
│   │       ├── StaffList.jsx
│   │       └── StaffForm.jsx
│   └── staff/
│       └── MyEarnings.jsx

frontend-mobile/src/
├── api/
│   └── attendanceApi.js
└── pages/
    ├── Attendance.jsx
    ├── Earnings.jsx
    └── Home.jsx
```

---

## 7. GAPS — What Exists vs. What Must Be Built

### What EXISTS Today

| Feature | Maturity |
|---------|----------|
| Staff/employee profiles (`StaffProfile` + `User`) | Production-ready |
| Designation as free-text field | Production-ready |
| RBAC roles and permissions | Production-ready |
| Shift master (start/end times) | Production-ready |
| Attendance punch in/out with geofence | Production-ready |
| Attendance status enum incl. `on_leave` | Production-ready |
| Monthly attendance summary (`payable_days` counts) | Production-ready |
| Base salary on staff profile | Production-ready |
| Commission accrual (`CommissionEntry`) | Production-ready |
| Staff earnings view (base + commission) | Production-ready |
| Monthly sales targets | Production-ready |
| Weekly off display (Sunday, UI-only) | Partial — hardcoded, not per-employee |
| Owner reports attendance snapshot | Production-ready |

### What Does NOT Exist (Build From Scratch)

| Feature | Notes |
|---------|-------|
| **Leave request model** | No `LeaveRequest` collection |
| **Apply-leave flow** | No API, no UI form |
| **Leave approval workflow** | No pending/approved/rejected states |
| **Leave types (structured)** | `leave_types` Mixed field exists but unused |
| **Leave quota / balance** | Not tracked |
| **Leave clash detection** | Not implemented |
| **Leave swap** | Not implemented |
| **Per-employee weekly off** | Only global Sunday in frontend |
| **Weekly off in database** | Not persisted |
| **Salary deduction engine** | Payable days counted but not applied to salary |
| **PayrollRun / PayrollEntry models** | Planned, not built |
| **`/api/payroll` routes** | Comment-only in `arnavRoutes.js` |
| **`payrollService.js`** | Does not exist |
| **Late-mark deduction logic** | `late_mark_minutes` in model, not enforced |
| **`evaluateDeduction` backend** | Referenced in broken frontend stub only |
| **Attendance rules API (mounted)** | Routes file exists, not registered |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTED                               │
├─────────────────────────────────────────────────────────────────┤
│  User ──► StaffProfile (designation, base_salary, shift_id)     │
│              │                                                   │
│              ▼                                                   │
│         Attendance (punch in/out, status incl. on_leave)        │
│              │                                                   │
│              ▼                                                   │
│    GET /attendance/summary → payable_days (counts only)         │
│                                                                  │
│  CommissionEntry ← billingService (payroll_run_id: null)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     NOT IMPLEMENTED / STUB                       │
├─────────────────────────────────────────────────────────────────┤
│  LeaveRequest (apply, approve, reject, swap)                    │
│  Leave clash detection                                          │
│  Leave types (structured)                                       │
│  Per-employee weekly off                                        │
│  Salary deduction = f(attendance, leave)                        │
│  PayrollRun / PayrollEntry                                      │
│  POST /api/payroll/runs                                         │
│  AttendanceRule API (mounted + consumed)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommendations for Your Feature Build

### Natural Integration Points

1. **New `LeaveRequest` model** — fields to consider: `staff_id`, `date_from`, `date_to`, `leave_type`, `status` (pending/approved/rejected/cancelled), `reason`, `approved_by`, `swap_with_staff_id`, `original_date`, `swap_date`
2. **Mount `attendanceRuleRoutes`** — or fold `leave_types` config into a new leave settings module
3. **Extend or sync with `Attendance`** — approved leave should create/update `Attendance` records with `status: "on_leave"` and optionally a `leave_request_id` ref
4. **Clash detection** — query overlapping approved leave for same designation/role on same dates; also check against `Booking` assignments for stylists
5. **Salary deduction** — consume `GET /api/attendance/summary` payable-days data in a new `payrollService.js`; formula: `(base_salary / working_days_in_month) × unpaid_days`
6. **Weekly off** — move from hardcoded Sunday to per-staff or per-branch config before clash detection is meaningful

### Key Files to Extend (Not Replace)

| File | Why |
|------|-----|
| `backend/routes/attendanceRoutes.js` | Summary endpoint already returns leave/absent counts |
| `backend/models/Attendance.js` | Add optional `leave_request_id`, `leave_type` refs |
| `backend/models/AttendanceRule.js` | Structured `leave_types` schema |
| `backend/routes/preciousRoutes.js` | Mount new leave + attendance-rules routes |
| `frontend/src/pages/precious/attendanceUtils.js` | Weekly off logic currently frontend-only |
| `implementation-tracker-csv/06_Attendance-Payroll.csv` | Planned payroll architecture to align with |

---

*This report is read-only. No files were modified during this audit.*
