# CLAUDE.md — Weekly Report Generator & Team Dashboard

Internal tool: **members** submit structured weekly reports, **managers** review them (approve / request changes) and analyse the team on a chart dashboard.
Treat this as a real client project: production-quality, secure, tested, explainable line by line (the author must defend every file in a live coding round).

## Reference files (read before working on the related area)

- DB schema (source of truth): `backend/prisma/schema.prisma` (header comment holds required raw SQL constraints)
- API contract + dashboard metric definitions + `ReportContent` shape: `docs/API.md`
- Do not duplicate those here. If code and these files disagree, stop and flag it.

## Stack (fixed, do not swap)

- **Backend:** NestJS (REST, prefix `/api/v1`), TypeScript, class-validator/class-transformer, Swagger, Prisma + PostgreSQL, bcrypt, JWT (httpOnly cookie), `@nestjs/throttler`, helmet, luxon
- **Frontend:** Next.js App Router, TypeScript, Tailwind, shadcn/ui, React Hook Form + Zod, TanStack Query, Recharts
- **Tests:** Jest + Supertest (backend e2e + unit), optional Vitest/RTL for the report form
- **Infra:** docker-compose (Postgres dev + test DB), Vercel (frontend), Railway/Render (backend + DB)
- **Repo:** two independent packages (`backend/`, `frontend/`) in one git repo. **No npm/pnpm workspaces.** Use npm.
- Pin the Prisma major version at scaffold time and don't upgrade mid-project. If the installed Prisma version needs different generator/datasource config than `schema.prisma` shows, adapt the config only, never the models.

## Commands (create these scripts in slice 0; keep this list accurate)

```
docker compose up -d                       # postgres (dev) + postgres-test
cd backend  && npm run start:dev           # API on :4000
cd backend  && npx prisma migrate dev      # new migration (use --create-only when adding raw SQL)
cd backend  && npm run seed                # idempotent seed
cd backend  && npm test                    # unit
cd backend  && npm run test:e2e            # e2e against TEST_DATABASE_URL
cd frontend && npm run dev                 # UI on :3000
cd frontend && npm run lint && npm run typecheck
```

Before saying a slice is done: lint, typecheck, build, and tests must pass for every package you touched.

## Architecture rules (hard)

- NestJS is the **only** backend. No Next.js API routes, no server actions for business logic.
- Browser calls `/api/v1/*` on the Next origin; `next.config.js` rewrites to `BACKEND_URL`. One origin, so no CORS and cookies just work.
- Frontend data fetching is client-side TanStack Query. Server components only for static layout.
- if need to handle client states use zustand
- `middleware.ts` is **UX only**: redirect when the cookie is missing, decode the role with `jose` (no verification) to redirect MEMBER away from `/manager/*` and non-ADMIN away from `/admin/*`. Backend guards are the real security boundary. Never trust the frontend role.
- Controllers are thin (parse, validate, authorise, delegate). Services hold logic. All multi-row writes use `prisma.$transaction`.
- No `any`. No business logic in React components (put it in hooks / `lib/`).

## Roles & visibility

Roles: `MEMBER`, `MANAGER`, `ADMIN` (ADMIN = MANAGER + user management). Public registration creates `MEMBER`; seed creates the first ADMIN; admin changes roles.

| Capability                                                   | MEMBER   | MANAGER           | ADMIN             |
| ------------------------------------------------------------ | -------- | ----------------- | ----------------- |
| Create/edit/submit/delete-draft **own** reports, own history | ✅       | ❌                | ❌                |
| Read reports                                                 | own only | any **non-draft** | any **non-draft** |
| Review (approve / request changes)                           | ❌       | ✅                | ✅                |
| Team week view, sections, member profile, dashboard          | ❌       | ✅                | ✅                |
| Projects: list                                               | ✅       | ✅                | ✅                |
| Projects: create/edit/archive/delete/assign members          | ❌       | ✅                | ✅                |
| User management                                              | ❌       | ❌                | ✅                |

Hard rules:

- Only MEMBERs write reports. Managers/admins have no personal report pages.
- A member requesting another member's report gets **404**, not 403.
- A manager requesting a `DRAFT` report gets **404**. Drafts are visible only to their owner (assignment requirement). `/team/week-status` may show `DRAFT` as a status but never content.
- **No endpoint lets a manager edit report content.** `POST /reports/:id/review` is the only manager write on a report.
- **Content a non-owner sees is always the snapshot of `currentVersion`**, never the working tables. This avoids showing a member's half-finished edits during `NEEDS_CORRECTION`. The owner sees the working copy.
- `ReportAccessService` (`assertCanRead` / `assertCanWrite` / `loadForViewer`) is the single RBAC choke point for report data. Every report endpoint goes through it.
- `JwtStrategy.validate()` loads the user from the DB on every request and rejects if missing or `isActive=false`; `req.user.role` comes from the DB, not the token. (Deactivation and role changes must apply immediately.)
- Admin cannot deactivate themselves, nor demote/deactivate the **last active ADMIN**.

## Report workflow (all logic in `ReportWorkflowService`)

```
DRAFT --submit--> SUBMITTED --approve--> APPROVED (locked)
                     └-- request changes (comment required) --> NEEDS_CORRECTION
NEEDS_CORRECTION --owner edits, resubmits--> SUBMITTED (new version)
```

- Transitions are defined in one const map (`from -> allowed actions`). Invalid transition or editing a `SUBMITTED`/`APPROVED` report → **409**.
- **Submit:** validate (see below) → bump `currentVersion` → write `ReportVersion` snapshot (immutable) → set `status`, `submittedAt`, and `firstSubmittedAt` only if null. One transaction.
- **Review:** only when `SUBMITTED`. Creates `Review` pointing at the version with `versionNumber = currentVersion`. `CHANGES_REQUESTED` requires a non-blank comment (trimmed, max 2000), else 400.
- **Concurrency:** state changes use a conditional update (`updateMany({ where: { id, status: <expected> } })`, expect `count === 1`, else 409) inside the transaction. `Review.versionId` is unique, so a version can be reviewed once.
- **Delete:** only `DRAFT` (a draft has never been submitted by definition).
- **Edit (`PATCH /reports/:id`):** owner only, status `DRAFT` or `NEEDS_CORRECTION`, replaces all child rows in one transaction.

## Report rules

- Fixed structure for everyone (see `docs/API.md` `ReportContent`). No customisation.
- `weekStart` must be a Monday; `weekEnd = weekStart + 6 days` (DB CHECK as well). One report per user per week. No week after the current one. Past weeks allowed (they will count as late).
- **Drafts save leniently:** child rows have DB defaults (`priority MEDIUM`, `status IN_PROGRESS`, percents/hours `0`), and `name`/`description` may be empty. Percents must still be 0–100 and hours ≥ 0 (DB CHECK).
- **Submit requires:** project set and non-archived, ≥1 task, every task has non-empty name, percents 0–100, hours ≥ 0. Rows with empty descriptions in next-week/blockers/achievements are rejected at submit (or dropped; pick one and keep it consistent).
- Max one key blocker and one key achievement per report: service check **and** partial unique index; map Prisma `P2002` to 409/400 via the exception filter.
- DTO string limits: task name ≤ 200, output/description ≤ 1000, notes ≤ 5000, links: ≤ 20 valid http(s) URLs, max 2000 chars each. Mirror in Zod.
- Project choice: any non-archived project (assignment via `ProjectMember` only sorts/suggests; it does not restrict). There is **no** per-task project override: workload-by-project uses `report.projectId`.
- Project delete → 409 if any report references it (suggest archive).

## Dates, deadlines, lateness

- API uses date-only strings `YYYY-MM-DD`. All week maths lives in `common/utils/week.util.ts` using luxon with `REPORT_TIMEZONE` (default `Asia/Colombo`). Never use bare `new Date()` for week logic.
- `deadline = weekStart 00:00 (REPORT_TIMEZONE) + REPORT_DUE_OFFSET_DAYS (default 7)`.
- Lateness uses **`Report.firstSubmittedAt`** (never overwritten on resubmit), not `submittedAt`.
- Compliance buckets (mutually exclusive, over _active members created on or before `weekEnd`_):
  - **onTime:** `firstSubmittedAt <= deadline`
  - **late:** `firstSubmittedAt > deadline`, or never submitted and `now > deadline`
  - **pending:** never submitted and `now <= deadline`
- "Not started" = eligible active member with no report row for that week.
- Full dashboard metric definitions: `docs/API.md`. Content aggregates (blockers, trends, hours, workload) count only reports in `SUBMITTED` or `APPROVED`, because those are the only statuses where the working copy is stable.

## Backend conventions

- Global `JwtAuthGuard`; `@Public()` opts out; `RolesGuard` + `@Roles()` per route. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Cookie `access_token`: httpOnly, SameSite=Lax, Secure in production, 1 day. `app.set('trust proxy', 1)`. Logout clears it. bcrypt cost ≥ 10. Throttle `/auth/login` and `/auth/register`. helmet on. `/health` endpoint (public).
- Errors: one global exception filter returning `{ statusCode, message, error }`; Prisma `P2002 → 409`, `P2025 → 404`. No stack traces to clients.
- Lists return `{ data, meta: { page, limit, total, totalPages } }`; `limit` default 20, max 100. Allow-list sort fields.
- Aggregations: `groupBy` / `$queryRaw` with parameters only. Never string-concatenate SQL. Keep aggregation in `dashboard.service.ts`, not controllers.
- Admin creates users with a temporary password they hand over (no email/invite flow); user changes it in settings. Never return `passwordHash`.
- Comment non-obvious code (guards, transactions, snapshotting, aggregation queries) in 1–3 lines explaining _why_.

## Frontend conventions

- shadcn/ui primitives; compose into feature components. Reuse `StatusBadge`, `DataTable`, `Pagination`, `FilterBar`, `KpiCard`. One read-only `ReportView` component shared by member detail, manager detail, and review page.
- Forms: React Hook Form + Zod mirroring backend rules; `useFieldArray` for tasks/blockers/achievements/next-week. Show server validation errors.
- Every data view has loading, empty, and error states. Responsive down to tablet; sidebar collapses on mobile.
- API calls only through `lib/api-client.ts` (`credentials: 'include'`, normalises errors, redirects to `/login` on 401). Query keys centralised per hook file. Invalidate relevant keys after mutations.
- Types are hand-written in `lib/types.ts`; keep them aligned with `docs/API.md`.

## Testing

- e2e runs against a separate DB (`TEST_DATABASE_URL`): `prisma migrate deploy` once, truncate between suites.
- **Write tests in the same slice as the feature**, not at the end.
- Minimum suite:
  - MEMBER: another member's report → 404; `GET /reports`, `/dashboard/*`, `/users`, `/reports/:id/review` → 403.
  - MANAGER: `PATCH /reports/:id` → no such capability (403/404/405, whichever the route gives); `GET` on a `DRAFT` → 404; review only when `SUBMITTED`; request changes without comment → 400.
  - Full cycle: submit → request changes → owner edit → resubmit (version 2) → approve; each review linked to the right version.
  - Invalid transitions and editing `SUBMITTED`/`APPROVED` → 409; double review → 409.
  - Deactivated user's existing cookie is rejected.
  - Non-owner sees snapshot, not working copy, while `NEEDS_CORRECTION` is being edited.
- Unit-test `ReportWorkflowService`, `week.util` (Monday check, deadline, timezone edge), and compliance bucketing.

## Environment variables

Backend: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET` (≥32 chars, required, no default), `JWT_EXPIRES_IN=1d`, `PORT=4000`, `NODE_ENV`, `REPORT_TIMEZONE=Asia/Colombo`, `REPORT_DUE_OFFSET_DAYS=7`, `ANTHROPIC_API_KEY` (optional slice only).
Frontend: `BACKEND_URL`.
Provide `.env.example` for both. Validate env at startup (fail fast). Never commit real secrets.

## Repo layout

```
backend/
  prisma/ schema.prisma, migrations/, seed.ts
  src/ main.ts, app.module.ts
    common/ decorators/ guards/ filters/ dto/pagination.dto.ts utils/week.util.ts
    prisma/  auth/  users/  projects/  team/  dashboard/  assistant/(optional)
    reports/ reports.controller.ts reports.service.ts report-workflow.service.ts
             report-access.service.ts report-snapshot.service.ts dto/
    reviews/
  test/ rbac.e2e-spec.ts workflow.e2e-spec.ts
frontend/src/
  app/ (auth)/login,register
       (app)/reports, reports/new, reports/[id], reports/[id]/edit,
             manager/dashboard, manager/reports, manager/reports/[id]/review,
             manager/team/[userId], manager/sections, projects, admin/users, settings
  components/ ui/ layout/ report-form/ report-view/ review/ dashboard/ common/
  lib/ api-client.ts types.ts week.ts validators/    hooks/    middleware.ts
docs/API.md
```

## Progress

Each slice = backend + frontend + tests, then update this section and commit.

- [ ] 0. Scaffold: two packages, docker-compose (dev + test DB), env files, Prisma migration (`--create-only` + raw SQL from schema header), exception filter, health, lint/CI scripts
- [ ] 1. Auth + guards + user management (+ RBAC e2e foundation, deactivation test)
- [ ] 2. Projects CRUD
- [ ] 3a. Reports backend: create/edit/submit/delete, snapshot, validation, access service (+ tests)
- [ ] 3b. Report form UI (tasks table, blockers, achievements, hours, notes) + history + detail
- [ ] 4. Review workflow + versions + manager review page (+ full-cycle e2e)
- [ ] 5. Seed script (needed before dashboard work)
- [ ] 6. Team week view, filters, status tracker, member profile, sections view
- [ ] 7. Dashboard KPIs + charts + activity feed
- [ ] 8. README (install/run frontend/backend/DB, demo credentials), deployment, ER diagram image generated from `schema.prisma`
- [ ] 9. (Optional) AI assistant: tool-use over existing services, manager/admin only, never raw SQL, send minimal fields, no emails/passwords to the LLM, document approach and privacy

Seed (idempotent): 1 admin, 1 manager, 5 members, 5 projects (Client A, Client B, Internal Tooling, R&D, Marketing), 8 weeks per member across all statuses (older mostly APPROVED; recent mixed), one member with no report this week, some late submissions, several reports with 2–3 versions and review comments, some unresolved blockers. Create versions/reviews with explicit timestamps.

## Decisions log (non-obvious ones only)

- Managers/non-owners always see the `currentVersion` snapshot; drafts invisible to managers.
- `Report.firstSubmittedAt` added so lateness survives resubmits.
- `Review.versionId` unique: one review per version.
- No per-task project override; no invite flow; no refresh tokens (1-day JWT, DB check per request).
- Hours stored as `Float`, validated to 0.25 steps in UI; round to 2 decimals in aggregates.
- Dashboard content aggregates exclude `DRAFT` and `NEEDS_CORRECTION`.
- No workspaces; luxon for week maths.

## Working agreement

- Work **one slice at a time**. Plan first in a few lines, then implement. Commit per slice (conventional commits).
- Edit files directly; don't paste whole files into chat. Summarise what changed and anything non-obvious (guards, transactions, snapshots, aggregation SQL) in a few lines so it can be defended live.
- If a request contradicts this file, say so and propose the CLAUDE.md edit **before** coding.
- Don't add dependencies, features, or abstractions beyond what a slice needs. Ask before adding a new library.
- Don't weaken a security rule or skip a test to make something pass. Fix the cause.
