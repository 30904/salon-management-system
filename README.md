# S21 Management System

Salon Management System — MERN + PWA  
**Organization:** Celeris Venture Systems  
**Repository:** https://github.com/celerisventures/s21-management-system

## Branch strategy

| Branch | Owner | Purpose |
|--------|-------|---------|
| `main` | Heramb / releases | Stable, merge-ready code |
| `dev-arnav` | Arnav | Foundation, RBAC, bookings, CRM, payroll, dashboard |
| `dev-precious` | Precious | Billing/POS, attendance, packages, WhatsApp |

Work on your own `dev-*` branch. Merge to `main` via PR after review.

## Docs in repo

- `Salon-Management-System-Implementation-Guide.md` — scoping / client-facing
- `Salon-Management-System-Technical-Spec.md` — developer build spec
- `Salon-Management-System-Implementation-Tracker.xlsx` — task tracker (156 tasks)

## Local setup (Phase 0)

```bash
# From project root — install all dependencies
npm install
npm run install:all

# Backend env (required before MongoDB task)
cd backend
copy .env.example .env    # Windows
# Paste MONGO_URI from Heramb into backend/.env

# Run both apps from root
cd ..
npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:5000/api/health  

### Dev seeds (in `backend/`)

Run in order on a fresh database, or use the all-in-one command:

```bash
npm run seed:branch   # Row 22 — default salon branch
npm run seed:roles    # Row 23 — roles + permissions
npm run seed:owner    # Row 24 — Owner/CEO dev user (auto-runs branch + roles if missing)
npm run seed:dev      # Rows 22–24 in one command — recommended
npm run seed:demo     # Row 25 — sample services/products for UI dev (optional)
```

`seed:demo` loads placeholder salon pricing until the client confirms their service list. Staff/shift demo data is a Precious-owned stub for now.

Optional in `backend/.env`: `SEED_BRANCH_*`, `SEED_OWNER_NAME`, `SEED_OWNER_PHONE`, `SEED_OWNER_EMAIL`  
Dev password is **not** stored in `.env.example` — use the table below for local login only.

### Dev login (after `npm run seed:dev` or `npm run seed:owner`)

| Field | Value |
|-------|-------|
| Phone | `9999999999` |
| Password | `Owner@123` |

Override phone/email via `SEED_OWNER_*` in your local `.env`. Override password locally with `SEED_OWNER_PASSWORD` if needed (never commit).

```bash
POST /api/auth/login
GET  /api/auth/me      # Bearer access token
POST /api/auth/refresh # body: { "refreshToken": "..." }
```

## Project structure

```
s21management/
├── backend/          # Node.js + Express (.js)
│   ├── routes/
│   │   ├── arnavRoutes.js      # Arnav modules
│   │   └── preciousRoutes.js   # Precious modules
│   ├── models/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── seeds/
│   └── utils/
├── frontend/         # React + Vite (.jsx)
└── package.json      # Root scripts: dev, install:all
```

## Merge-conflict rules

- Each dev owns their route file: `arnavRoutes` / `preciousRoutes` (backend + frontend).
- Shared components have a single owner — see tracker Overview sheet.
