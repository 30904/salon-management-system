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

### Dev login (after `npm run seed:owner` in backend)

| Field | Value |
|-------|-------|
| Phone | `9999999999` |
| Password | `Owner@123` |

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
