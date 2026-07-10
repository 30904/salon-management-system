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

## Local setup (coming in Phase 0)

```bash
# Backend
cd backend
cp .env.example .env   # add MONGO_URI from Heramb
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Merge-conflict rules

- Each dev owns their route file: `arnavRoutes` / `preciousRoutes` (backend + frontend).
- Shared components have a single owner — see tracker Overview sheet.
