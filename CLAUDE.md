# PROJECT.md — Weekly Report Generator & Team Dashboard

> Paste this file at the start of every Claude session. It is the single source of truth for design decisions.
> After finishing a slice, update **§12 Progress** and **§13 Decisions Log**, then commit.

## 1. Product summary

Internal tool where **team members** submit structured weekly work reports and **managers** review them (approve / request changes), then analyse the whole team on a chart-driven dashboard.

Core loop: `Draft → Submitted → (Needs Correction → edited → Submitted)* → Approved`.
Every submit creates an immutable **version snapshot**; every review comment is tied to the version it was made against.

## 2. Stack (fixed)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Query, Recharts |
| Backend | NestJS (REST), TypeScript, class-validator/class-transformer DTOs, Swagger |
| ORM / DB | Prisma + PostgreSQL |
| Auth | bcrypt password hashing, JWT in httpOnly cookie (SameSite=Lax, Secure in prod), 1-day expiry |
| Testing | Jest + Supertest (backend e2e for RBAC), optional Vitest/RTL on key forms |
| Infra | docker-compose (Postgres), Vercel (frontend), Railway/Render (backend + DB) |

**Frontend rules**
- Next.js is UI only. **No Next.js API routes / server actions for business logic.** NestJS is the only backend.
- `/api/*` is proxied to NestJS via `next.config.js` rewrites so the browser sees one origin (cookies just work, no CORS).
- Data fetching is client-side with TanStack Query. Server components only for static layouts.
- Route protection via `middleware.ts` (redirect unauthenticated; block MEMBER from `/manager/*`, non-ADMIN from `/admin/*`). Backend guards remain the real security boundary.

## 3. Roles & permissions

Roles: `MEMBER`, `MANAGER`, `ADMIN` (ADMIN = MANAGER + user management).

| Capability | MEMBER | MANAGER | ADMIN |
|---|---|---|---|
| Register / login / logout / account settings | ✅ | ✅ | ✅ |
| Create / edit / submit **own** reports | ✅ | ❌ | ❌ |
| View own report history & detail | ✅ | – | – |
| View **any** report (read-only content) | ❌ | ✅ | ✅ |
| Approve / request changes (status + comment only) | ❌ | ✅ | ✅ |
| Team dashboard, team profile, sections view | ❌ | ✅ | ✅ |
| Projects: list | ✅ | ✅ | ✅ |
| Projects: create / edit / archive / delete / assign members | ❌ | ✅ | ✅ |
| User management (create/invite, change role, deactivate) | ❌ | ❌ | ✅ |

Hard rules
- A MEMBER can never read or write another member's report (404, not 403, to avoid leaking existence).
- Managers have **no endpoint** that edits report content. Only `POST /reports/:id/review` changes status/comment.
- Only MEMBER accounts write reports. Managers/admins do not have personal report pages. (Keeps review logic free of self-review edge cases.)
- Public registration creates `MEMBER`. Admin promotes roles. Seed creates the first ADMIN.
- Deactivated users (`isActive=false`) cannot log in; their reports remain.

## 4. Report structure (fixed, identical for everyone)

Order of sections on the form (not customisable by users):

1. Week (Mon–Sun) and Project/category tag
2. Tasks completed — table: name, priority, planned %, actual %, status, planned hours, spent hours, output/deliverable
3. Tasks planned for next week
4. Blockers / challenges (one may be flagged **key issue**)
5. Achievements / highlights (one may be flagged **key achievement**)
6. Hours by task type (optional): Development, Testing, Meetings, Documentation, Design, Other
7. Notes and links (optional)

Validation
- `weekStart` must be a Monday; `weekEnd = weekStart + 6 days`. One report per user per week. No future weeks beyond the current one.
- Drafts save leniently. **Submit** requires: project set, ≥1 task, every task has name/priority/status, percentages 0–100, hours ≥ 0.
- At most one key blocker and one key achievement per report (service check + partial unique index).
- Blockers carry `isResolved` (used for the "open blockers" metric).

## 5. Status workflow (state machine)

```
DRAFT ──submit──▶ SUBMITTED ──approve──────────▶ APPROVED (locked)
                     │
                     └─request changes (comment required)─▶ NEEDS_CORRECTION
                                                                │ owner edits
                                                                └──resubmit──▶ SUBMITTED (new version)
```

| Transition | Who | Rules |
|---|---|---|
| create | MEMBER | status = DRAFT, `currentVersion = 0` |
| DRAFT → SUBMITTED | owner | full submit validation; create `ReportVersion` n=1 |
| SUBMITTED → APPROVED | MANAGER/ADMIN | creates `Review(APPROVED, versionId=current)` |
| SUBMITTED → NEEDS_CORRECTION | MANAGER/ADMIN | comment required; creates `Review(CHANGES_REQUESTED)` |
| NEEDS_CORRECTION → SUBMITTED | owner | validation again; create `ReportVersion` n+1 |

Editability: content editable **only** when status is `DRAFT` or `NEEDS_CORRECTION`, and only by the owner. `SUBMITTED` and `APPROVED` are read-only. Delete allowed only for `DRAFT` that was never submitted.
Invalid transitions return `409 Conflict`. All transition logic lives in one `ReportWorkflowService` (single place to unit test).

Versioning model
- Working copy lives in normalised tables (so charts/filters can query it).
- On every submit, a full JSON **snapshot** is written to `ReportVersion` (immutable).
- Each `Review` stores `versionId`, so the UI can show "comment made against version 2".
- Manager review page shows the current version plus a list of past versions (number, submitted timestamp) viewable on demand, with each version's review comment.

"Not yet started" = an active MEMBER with no report row for the selected week.
"Late" = report not submitted (or submitted) after the deadline. Deadline = end of Sunday of the report week (`REPORT_DUE_OFFSET_DAYS` constant, default 7 days after `weekStart` at 00:00). Pending = not submitted and still before deadline.

## 6. Database schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role         { MEMBER MANAGER ADMIN }
enum ReportStatus { DRAFT SUBMITTED NEEDS_CORRECTION APPROVED }
enum Priority     { LOW MEDIUM HIGH CRITICAL }
enum TaskStatus   { COMPLETED IN_PROGRESS BLOCKED DEFERRED }
enum TaskType     { DEVELOPMENT TESTING MEETINGS DOCUMENTATION DESIGN OTHER }
enum ReviewAction { APPROVED CHANGES_REQUESTED }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String
  role         Role     @default(MEMBER)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  reports            Report[]
  reviews            Review[]
  versionsSubmitted  ReportVersion[]
  projectMemberships ProjectMember[]
}

model Project {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  color       String?
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members ProjectMember[]
  reports Report[]
  tasks   ReportTask[]
}

model ProjectMember {
  projectId String
  userId    String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([projectId, userId])
}

model Report {
  id             String       @id @default(uuid())
  userId         String
  projectId      String
  weekStart      DateTime     @db.Date
  weekEnd        DateTime     @db.Date
  status         ReportStatus @default(DRAFT)
  currentVersion Int          @default(0)   // latest submitted version number, 0 = never submitted
  notes          String?
  links          String[]
  submittedAt    DateTime?                  // latest submission time
  reviewedAt     DateTime?                  // latest review time
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  project  Project   @relation(fields: [projectId], references: [id], onDelete: Restrict)

  tasks         ReportTask[]
  nextWeekTasks NextWeekTask[]
  blockers      Blocker[]
  achievements  Achievement[]
  timeEntries   TimeEntry[]
  versions      ReportVersion[]
  reviews       Review[]

  @@unique([userId, weekStart])
  @@index([status])
  @@index([weekStart])
  @@index([projectId])
}

model ReportTask {
  id             String     @id @default(uuid())
  reportId       String
  projectId      String?                       // optional override; falls back to report.projectId
  position       Int
  name           String
  priority       Priority
  plannedPercent Int                           // 0-100
  actualPercent  Int                           // 0-100
  status         TaskStatus
  plannedHours   Float
  spentHours     Float
  output         String?

  report  Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([reportId])
}

model NextWeekTask {
  id             String   @id @default(uuid())
  reportId       String
  position       Int
  description    String
  priority       Priority @default(MEDIUM)
  estimatedHours Float?

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
}

model Blocker {
  id          String  @id @default(uuid())
  reportId    String
  position    Int
  description String
  isKey       Boolean @default(false)
  isResolved  Boolean @default(false)

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
}

model Achievement {
  id          String  @id @default(uuid())
  reportId    String
  position    Int
  description String
  isKey       Boolean @default(false)

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
}

model TimeEntry {
  id       String   @id @default(uuid())
  reportId String
  taskType TaskType
  hours    Float

  report Report @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@unique([reportId, taskType])
}

model ReportVersion {
  id            String   @id @default(uuid())
  reportId      String
  versionNumber Int
  snapshot      Json                          // full report content at submit time (see shape below)
  submittedById String
  submittedAt   DateTime @default(now())

  report      Report @relation(fields: [reportId], references: [id], onDelete: Cascade)
  submittedBy User   @relation(fields: [submittedById], references: [id])
  reviews     Review[]

  @@unique([reportId, versionNumber])
}

model Review {
  id         String       @id @default(uuid())
  reportId   String
  versionId  String                            // the version this review was made against
  reviewerId String
  action     ReviewAction
  comment    String?                           // required when CHANGES_REQUESTED, optional on APPROVED
  createdAt  DateTime     @default(now())

  report   Report        @relation(fields: [reportId], references: [id], onDelete: Cascade)
  version  ReportVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  reviewer User          @relation(fields: [reviewerId], references: [id])

  @@index([reportId])
  @@index([createdAt])
}
```

Raw SQL added in the first migration (partial unique indexes, one key item per report):
```sql
CREATE UNIQUE INDEX blocker_one_key_per_report ON "Blocker" ("reportId") WHERE "isKey" = true;
CREATE UNIQUE INDEX achievement_one_key_per_report ON "Achievement" ("reportId") WHERE "isKey" = true;
```

Snapshot JSON shape (`ReportVersion.snapshot`):
```json
{
  "weekStart": "2026-09-21", "weekEnd": "2026-09-27",
  "project": { "id": "...", "name": "..." },
  "tasks": [{ "name": "", "priority": "", "plannedPercent": 0, "actualPercent": 0, "status": "", "plannedHours": 0, "spentHours": 0, "output": "" }],
  "nextWeekTasks": [{ "description": "", "priority": "", "estimatedHours": 0 }],
  "blockers": [{ "description": "", "isKey": false, "isResolved": false }],
  "achievements": [{ "description": "", "isKey": false }],
  "timeEntries": [{ "taskType": "DEVELOPMENT", "hours": 0 }],
  "notes": "", "links": []
}
```

Relationships (for the ER diagram): User 1─* Report; Project 1─* Report; Project *─* User via ProjectMember; Report 1─* ReportTask / NextWeekTask / Blocker / Achievement / TimeEntry; Report 1─* ReportVersion; Report 1─* Review; ReportVersion 1─* Review; User 1─* Review (as reviewer); User 1─* ReportVersion (as submitter).

## 7. REST API (prefix `/api/v1`)

Global `JwtAuthGuard`; `@Public()` opts out. `RolesGuard` + `@Roles(...)` per route. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
List endpoints return `{ data: [], meta: { page, limit, total, totalPages } }`.

**Auth**
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/register | public | creates MEMBER |
| POST | /auth/login | public | sets httpOnly cookie |
| POST | /auth/logout | any | clears cookie |
| GET | /auth/me | any | current user |
| PATCH | /auth/me | any | update name |
| POST | /auth/change-password | any | current + new password |

**Users**
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /users | ADMIN | paginated; filter role, isActive, search |
| POST | /users | ADMIN | create/invite with role |
| PATCH | /users/:id | ADMIN | change role / name / isActive |
| DELETE | /users/:id | ADMIN | soft deactivate (cannot deactivate self) |
| GET | /users/team | MANAGER, ADMIN | active members with basic stats |
| GET | /users/:id/profile | MANAGER, ADMIN | member info + stats (report counts by status, on-time rate, avg hours) |

**Projects**
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /projects | any | filter `includeArchived` |
| POST | /projects | MANAGER, ADMIN | |
| PATCH | /projects/:id | MANAGER, ADMIN | edit / archive |
| DELETE | /projects/:id | MANAGER, ADMIN | 409 if referenced by reports (suggest archive) |
| PUT | /projects/:id/members | MANAGER, ADMIN | replace assigned member ids |

**Reports — member**
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports/me | MEMBER | own history; filters status, from, to; paginated |
| POST | /reports | MEMBER | create draft for a week |
| PATCH | /reports/:id | MEMBER (owner) | only DRAFT / NEEDS_CORRECTION; full-content replace of child rows in one transaction |
| DELETE | /reports/:id | MEMBER (owner) | DRAFT never submitted |
| POST | /reports/:id/submit | MEMBER (owner) | DRAFT/NEEDS_CORRECTION → SUBMITTED, writes version |

**Reports — shared read**
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports/:id | owner, MANAGER, ADMIN | full report + latest review; 404 for non-owner members |
| GET | /reports/:id/versions | owner, MANAGER, ADMIN | list (number, submittedAt, review summary) |
| GET | /reports/:id/versions/:n | owner, MANAGER, ADMIN | snapshot + reviews made against it |
| GET | /reports/:id/reviews | owner, MANAGER, ADMIN | review comment history |

**Reports — manager**
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports | MANAGER, ADMIN | filters: `weekStart`, `from`, `to`, `userId`, `projectId`, `status`; paginated |
| POST | /reports/:id/review | MANAGER, ADMIN | body `{ action: APPROVED \| CHANGES_REQUESTED, comment? }`; only when SUBMITTED |
| GET | /team/week-status | MANAGER, ADMIN | `weekStart` → each active member with status incl. NOT_STARTED |
| GET | /team/sections | MANAGER, ADMIN | `weekStart`, `section=blockers\|achievements\|nextWeek\|notes` → side-by-side across members |

**Dashboard (MANAGER, ADMIN)**
| Method | Path | Returns |
|---|---|---|
| GET | /dashboard/summary?weekStart | total submitted, compliance (submitted/pending/late), needs-correction count, open blockers |
| GET | /dashboard/tasks-trend?from&to&userId? | completed tasks per week (team or one person) |
| GET | /dashboard/status-by-member?weekStart | status counts per member |
| GET | /dashboard/workload-by-project?from&to | task count / hours per project |
| GET | /dashboard/time-by-type?from&to | hours per task type, team-wide |
| GET | /dashboard/activity?limit | recent submissions + review actions |

**Assistant (optional, later):** `POST /assistant/chat` (MANAGER, ADMIN) — LLM with tool-use over the report queries above.

## 8. Backend structure (NestJS)

```
backend/
  prisma/ schema.prisma, migrations/, seed.ts
  src/
    main.ts, app.module.ts
    common/  decorators/(roles, public, current-user)  guards/(jwt-auth, roles)
             filters/  pipes/  dto/pagination.dto.ts  utils/(week.util.ts)
    prisma/  prisma.module.ts, prisma.service.ts
    auth/    controller, service, jwt.strategy, dto/
    users/   controller, service, dto/
    projects/ controller, service, dto/
    reports/ reports.controller.ts, reports.service.ts,
             report-workflow.service.ts, report-access.service.ts,
             report-snapshot.service.ts, dto/
    reviews/ reviews.controller.ts, reviews.service.ts
    team/    controller, service
    dashboard/ controller, service (aggregation queries)
    assistant/ (later)
  test/ rbac.e2e-spec.ts, workflow.e2e-spec.ts
```
Conventions: controllers thin (parse/validate/authorise), services hold logic, `ReportAccessService.assertCanRead/Write(user, report)` is the single RBAC choke point for report data, all multi-row writes in `prisma.$transaction`.

## 9. Frontend structure (Next.js App Router)

```
frontend/src/
  app/
    (auth)/login, register
    (app)/                      # authenticated shell (sidebar layout)
      reports/                  # MEMBER: history list
      reports/new, reports/[id]/edit
      reports/[id]              # read-only detail (member + manager)
      manager/dashboard
      manager/reports           # week view + filters + status tracker
      manager/reports/[id]/review
      manager/team/[userId]     # member profile
      manager/sections          # side-by-side section comparison
      projects                  # CRUD page
      admin/users
      settings
  components/  ui/(shadcn)  layout/  report-form/(TaskTable, BlockerList, AchievementList, HoursByType)
               report-view/  review/(ReviewPanel, VersionList, StatusBadge)
               dashboard/(KpiCard, charts/*)  common/(DataTable, Pagination, FilterBar)
  lib/     api-client.ts  auth.ts  week.ts  validators/(zod schemas)
  hooks/   use-reports.ts, use-dashboard.ts, ...
  middleware.ts
```

## 10. Pages (13, requirement is ≥7)

1. Login 2. Register 3. Personal weekly report create/edit 4. Report history (member) 5. Report detail (read-only, shared) 6. Manager review page (approve / request changes, versions, comment history) 7. Manager team week view (filters + status tracker) 8. Manager dashboard (KPIs + charts + activity feed) 9. Team member profile (manager) 10. Sections side-by-side (bonus) 11. Projects management 12. User management (admin) 13. Account settings

## 11. Seed data & tests

Seed (`prisma/seed.ts`, idempotent): 1 admin, 1 manager, 5 members, 5 projects (Client A, Client B, Internal Tooling, R&D, Marketing), 8 weeks of reports per member across all statuses (mostly APPROVED in older weeks; recent weeks mix SUBMITTED / NEEDS_CORRECTION / DRAFT; one member with no report this week; a few late submissions; several reports with 2–3 versions and review comments; some unresolved blockers). Demo password documented in README.

Automated tests (minimum)
- MEMBER cannot GET another member's report (404), cannot list `/reports`, cannot hit `/dashboard/*`, `/users`, `/reports/:id/review`.
- Manager cannot PATCH report content; can only review a SUBMITTED report; request-changes without comment → 400.
- Full cycle: submit → request changes → owner edit → resubmit (version 2) → approve.
- Invalid transitions → 409; editing SUBMITTED/APPROVED → 409.

## 12. Progress

- [ ] 0. Repo scaffold: monorepo, docker-compose, env files, create Nestjs for backend and nextjs for frontend, Prisma migration
- [ ] 1. Auth + RBAC guards + user management (admin)
- [ ] 2. Projects CRUD
- [ ] 3. Report create/edit/submit (form, tasks table, blockers, achievements, hours)
- [ ] 4. Report history + detail page
- [ ] 5. Review workflow + versions + manager review page
- [ ] 6. Seed script
- [ ] 7. Team week view, filters, member profile, sections view
- [ ] 8. Dashboard KPIs + charts + activity feed
- [ ] 9. RBAC + workflow e2e tests
- [ ] 10. README, deployment
- [ ] 11. (Optional) AI assistant

## 13. Decisions log

- Next.js used as UI only; single backend = NestJS; `/api` proxied via rewrites.
- Only MEMBER role writes reports; managers/admins only review and analyse.
- One report per member per week; one project tag per report, optional per-task project override for the workload chart (falls back to report project).
- Working copy is normalised; every submit also writes an immutable JSON snapshot (`ReportVersion`); each `Review` points to the version it was made against.
- Manager visibility: all active members (no manager→team hierarchy).
- Member accessing someone else's report gets 404, not 403.
- Open blockers metric = unresolved blockers on non-draft reports of the selected week.
- Late = not submitted by end of Sunday of the report week (constant, easy to change).
- Single JWT httpOnly cookie (1 day) for sessions; refresh tokens deferred.
- Projects: archive preferred; hard delete only when unreferenced.

## 14. Working agreement for Claude sessions

- Implement one slice per request, backend + frontend + tests together, matching this file exactly.
- Return **complete files with paths**; no partial snippets unless asked.
- If a change contradicts this file, say so and propose the update to PROJECT.md first.
- Explain non-obvious code (guards, transactions, snapshotting, aggregation queries) briefly so I can defend it in a live coding round.
