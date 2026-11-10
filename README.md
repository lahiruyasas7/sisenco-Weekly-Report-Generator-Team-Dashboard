# Weekly Report Generator & Team Dashboard

An internal tool for **members** to submit structured weekly reports and **managers/admins** to review them (approve / request changes) and analyse the team on a chart dashboard.

---

## Stack

| Layer        | Technology                                                                 |
|--------------|----------------------------------------------------------------------------|
| **Backend**  | NestJS (REST, `/api/v1`), TypeScript, Prisma + PostgreSQL, bcrypt, JWT (httpOnly cookie), `@nestjs/throttler`, helmet, luxon, Swagger |
| **Frontend** | Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Query, Recharts |
| **Tests**    | Vitest (backend unit & e2e with Supertest; frontend unit with RTL)         |
| **Infra**    | docker-compose (Postgres), Vercel (frontend), Railway/Render (backend + DB) |
| **Repo**     | Two independent packages (`backend/`, `frontend/`) in one git repo — **no workspaces** |

---

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 24+ (for running without Docker)

### 1. Start the Database
```bash
docker compose up -d postgres
```
PostgreSQL runs on `localhost:5433` (user: `sisenco`, password: `sisenco123`, db: `sisenco`).

### 2. Configure Environment Variables
Copy the example files and fill in required values:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set JWT_SECRET (≥32 bytes) and INITIAL_ADMIN_* for seeding

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env if BACKEND_URL differs from http://localhost:3001
```

### 3. Install Dependencies & Generate Prisma Client
```bash
cd backend  && npm ci && npm run prisma:generate
cd frontend && npm ci
```

### 4. Run Database Migrations
```bash
cd backend && npm run prisma:migrate:dev -- --name init
```

### 5. Seed the Database (Admin + Demo Data)
```bash
cd backend && npm run seed
```
This creates:
- **1 Admin** (from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`)
- **1 Manager** (`demo.manager@example.test`)
- **5 Members** (`demo.member1@example.test` … `demo.member5@example.test`)
- **5 Projects** (Client A, Client B, Internal Tooling, R&D, Marketing)
- **8 weeks of reports** per member across all statuses (with versions & reviews)

> All demo accounts use the password from `DEMO_SEED_PASSWORD`.

### 6. Start Development Servers
```bash
# Terminal 1: Backend on :3001
cd backend && npm run start:dev

# Terminal 2: Frontend on :3000
cd frontend && npm run dev
```

Open **http://localhost:3000** — the frontend proxies `/api/v1/*` to the backend.

---

## Demo Credentials (After Seeding)

| Role    | Email                          | Password               |
|---------|--------------------------------|------------------------|
| Admin   | (your `INITIAL_ADMIN_EMAIL`)   | (your `INITIAL_ADMIN_PASSWORD`) |
| Manager | `demo.manager@example.test`    | `DEMO_SEED_PASSWORD`   |
| Member 1| `demo.member1@example.test`    | `DEMO_SEED_PASSWORD`   |
| Member 2| `demo.member2@example.test`    | `DEMO_SEED_PASSWORD`   |
| Member 3| `demo.member3@example.test`    | `DEMO_SEED_PASSWORD`   |
| Member 4| `demo.member4@example.test`    | `DEMO_SEED_PASSWORD`   |
| Member 5| `demo.member5@example.test`    | `DEMO_SEED_PASSWORD`   |

> Demo accounts are only created outside production (`NODE_ENV !== 'production'`).

---

## Manual Commands

### Backend
```bash
cd backend

# Development
npm run start:dev          # Watch mode on :3001
npm run prisma:migrate:dev -- --name <migration-name>  # Create & apply migration
npm run seed               # Seed admin + demo data (idempotent)

# Quality
npm run format:check       # Prettier check
npm run lint               # Oxlint
npm run test               # Unit tests
npm run test:e2e           # E2E tests (needs disposable DATABASE_URL)
npm run build              # Production build (outputs to dist/)

# Prisma
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate:deploy  # Apply migrations in CI/production
```

### Frontend
```bash
cd frontend

# Development
npm run dev                # Next.js dev server on :3000

# Quality
npm run format:check       # Prettier check
npm run lint               # ESLint
npm run typecheck          # TypeScript + Next.js typegen
npm run test               # Vitest unit tests
npm run test:watch         # Vitest watch mode
npm run build              # Production build (.next/)
npm run start              # Run production build
```

### Full CI Check (Both Packages)
```bash
cd backend  && npm run format:check && npm run lint && npm run build
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm run build
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment |
| `PORT` | No | `3001` | HTTP port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | — | ≥32 random bytes; no default |
| `FRONTEND_ORIGIN` | No | `http://localhost:3000` | CORS origin (cookie SameSite) |
| `REPORT_TIMEZONE` | No | `Asia/Colombo` | IANA zone for week maths |
| `REPORT_DUE_OFFSET_DAYS` | No | `7` | Days after weekStart for deadline |
| `INITIAL_ADMIN_EMAIL` | Seed only | — | First admin email |
| `INITIAL_ADMIN_NAME` | Seed only | — | First admin name |
| `INITIAL_ADMIN_PASSWORD` | Seed only | — | First admin password (≥15 bytes) |
| `DEMO_SEED_PASSWORD` | Non-prod seed | — | Demo accounts password (15–72 bytes) |

### Frontend (`frontend/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | No | `http://localhost:3001` | Backend API base (proxied via Next.js rewrites) |
| `NEXT_PUBLIC_REPORT_TIMEZONE` | No | `Asia/Colombo` | **Must match** backend `REPORT_TIMEZONE` |

---

## Deployment

### Docker Images (Production)

#### Backend
```bash
docker build -t sisenco-backend ./backend
```
- Multi-stage: builder → runtime (`node:24-bookworm-slim`)
- Runs as non-root `node` user
- Healthcheck: `GET /health`

#### Frontend
```bash
docker build -t sisenco-frontend ./frontend
```
- Multi-stage: builder → runtime (`node:24-bookworm-slim`)
- Runs `next start` on port 3000
- Healthcheck: `GET /health`

### Docker Compose (Production)
```bash
# Create production env files
cp backend/.env.example backend/.env.prod
cp frontend/.env.example frontend/.env.prod
# Edit both with production values (strong JWT_SECRET, real DATABASE_URL, etc.)

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**`docker-compose.prod.yml`** (create this file):
```yaml
services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: sisenco
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: sisenco
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sisenco -d sisenco"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env.prod
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 3

  frontend:
    build: ./frontend
    restart: unless-stopped
    env_file: ./frontend/.env.prod
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 3

volumes:
  postgres_data:
```

### Platform-Specific

| Platform | Notes |
|----------|-------|
| **Vercel** (Frontend) | Connect repo, set `BACKEND_URL` to your Railway/Render backend URL. No build config changes needed. |
| **Railway / Render** (Backend + DB) | Use the backend `Dockerfile`. Provide `DATABASE_URL` (managed Postgres), `JWT_SECRET`, `FRONTEND_ORIGIN` (your Vercel URL). Run `npm run prisma:migrate:deploy` on deploy. |
| **Self-Hosted** | Use `docker-compose.prod.yml` above with a reverse proxy (nginx/Traefik) for TLS. |

---

## Database (Prisma)

```bash
cd backend

# Generate client after schema changes
npm run prisma:generate

# Create a migration (development)
npm run prisma:migrate:dev -- --name <descriptive-name>

# Apply migrations (CI / production)
npm run prisma:migrate:deploy

# Open Prisma Studio
npx prisma studio

# ER Diagram (see docs/ER-diagram.png)
npx prisma-erd --output=../docs/ER-diagram.png
```

> **Important:** Prisma major version is pinned at scaffold time. If the installed version requires different generator/datasource config, adapt the config only — never the models.

---

## API Documentation

- **OpenAPI/Swagger UI**: `GET /api/docs` (when backend runs)
- **Contract & Dashboard Metrics**: [`docs/API.md`](docs/API.md)
- **ReportContent Shape**: Defined in `docs/API.md` — used for snapshots and API responses

---

## Entity Relationship Diagram

![ER Diagram](docs/ER-diagram.png)

*Generated from `backend/prisma/schema.prisma` using `prisma-erd`.*

---

## Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Source of truth for DB
│   │   ├── migrations/            # Migration history
│   │   ├── seed.ts                # Admin + demo seed (idempotent)
│   │   ├── demo-seed.ts           # Demo data builder
│   │   └── demo-fixtures.ts       # Typed demo fixtures
│   ├── src/
│   │   ├── main.ts                # Bootstrap, global pipes/guards/filters
│   │   ├── app.module.ts
│   │   ├── common/                # Decorators, guards, filters, utils
│   │   ├── auth/                  # JWT, sessions, bcrypt, throttling
│   │   ├── users/                 # Admin user management
│   │   ├── projects/              # Project CRUD + assignments
│   │   ├── reports/               # Report CRUD, workflow, snapshots, access control
│   │   ├── team/                  # Manager team views (week status, sections)
│   │   ├── dashboard/             # KPIs, charts, activity feed
│   │   └── config/                # Env validation
│   └── test/                      # E2E tests (RBAC, workflow)
├── frontend/
│   ├── app/
│   │   ├── (auth)/                # Login, register, change-password
│   │   └── (app)/                 # Protected routes
│   │       ├── reports/           # Member: list, new, detail, edit
│   │       ├── manager/           # Manager: dashboard, reports, review, team, sections
│   │       ├── admin/             # Admin: users
│   │       ├── projects/          # Project list
│   │       └── settings/          # Profile, password
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── layout/                # Sidebar, header
│   │   ├── report-form/           # Form sections (tasks, blockers, etc.)
│   │   ├── report-view/           # Read-only ReportView (shared)
│   │   ├── review/                # Review page components
│   │   ├── dashboard/             # KPI cards, charts
│   │   └── common/                # StatusBadge, DataTable, Pagination, FilterBar
│   ├── lib/
│   │   ├── api-client.ts          # Fetch wrapper (credentials, 401 redirect)
│   │   ├── types.ts               # Hand-written types matching API.md
│   │   ├── week.ts                # Week helpers (Monday, formatting)
│   │   ├── validators/            # Zod schemas mirroring backend DTOs
│   │   └── hooks/                 # TanStack Query hooks
│   └── middleware.ts              # UX-only redirect to /login
├── docs/
│   ├── API.md                     # Full API contract
│   └── ER-diagram.png             # Generated ER diagram
├── docker-compose.yml             # Dev DB only
├── docker-compose.prod.yml        # Production stack (create from template)
└── CLAUDE.md                      # Project instructions (this project's constitution)
```

---

## Roles & Permissions Summary

| Capability | MEMBER | MANAGER | ADMIN |
|------------|--------|---------|-------|
| Create/edit/submit/delete own reports | ✅ | ❌ | ❌ |
| Read reports | Own only | Non-draft | Non-draft |
| Review (approve/request changes) | ❌ | ✅ | ✅ |
| Team week view, sections, profile, dashboard | ❌ | ✅ | ✅ |
| Projects: list | ✅ | ✅ | ✅ |
| Projects: create/edit/archive/delete/assign | ❌ | ✅ | ✅ |
| User management | ❌ | ❌ | ✅ |

**Hard rules:**
- Drafts visible only to owner (managers get 404)
- Non-owners always see the `currentVersion` snapshot (never working copy)
- No endpoint lets a manager edit report content
- Deactivated users' cookies are rejected immediately (DB session check per request)

---

## Report Workflow

```
DRAFT --submit--> SUBMITTED --approve--> APPROVED (locked)
                     └-- request changes --> NEEDS_CORRECTION
NEEDS_CORRECTION --owner edits, resubmits--> SUBMITTED (new version)
```

- Submit: validates → bumps `currentVersion` → writes immutable `ReportVersion` snapshot → sets status/submittedAt/firstSubmittedAt (once)
- Review: only on `SUBMITTED`; `CHANGES_REQUESTED` requires comment (≤2000 chars)
- Concurrency: conditional `updateMany` on expected status (409 if stale)
- Delete: only `DRAFT` reports
- Edit: owner only, `DRAFT` or `NEEDS_CORRECTION`, replaces all child rows in one transaction

---

## Testing

```bash
# Backend
cd backend
npm test              # Unit tests
npm run test:e2e      # E2E tests (needs isolated PostgreSQL)

# Frontend
cd frontend
npm test              # Unit tests (Vitest + RTL)
npm run test:watch    # Watch mode
```

**CI** runs on every push/PR (see `.github/workflows/ci.yml`):
- Backend: format → lint → unit tests → migrate → e2e → build → Docker build
- Frontend: format → lint → typecheck → build

---

## License

UNLICENSED — Internal tool for Sisenco Assessment.