# API contract (prefix `/api/v1`)

Global `JwtAuthGuard`; `@Public()` opts out. Lists return `{ data: [], meta: { page, limit, total, totalPages } }`.
Dates are `YYYY-MM-DD` strings. Errors: `{ statusCode, message, error }`.

## ReportContent (used for snapshots AND for the API response body of a report)

Working tables are mapped into this shape for the owner. Non-owners get the `currentVersion` snapshot in this same shape, so the frontend uses one `ReportView` component.

```json
{
  "weekStart": "2026-09-21", "weekEnd": "2026-09-27",
  "project": { "id": "", "name": "" },
  "tasks": [{ "name": "", "priority": "MEDIUM", "plannedPercent": 0, "actualPercent": 0, "status": "IN_PROGRESS", "plannedHours": 0, "spentHours": 0, "output": "" }],
  "nextWeekTasks": [{ "description": "", "priority": "MEDIUM", "estimatedHours": 0 }],
  "blockers": [{ "description": "", "isKey": false, "isResolved": false }],
  "achievements": [{ "description": "", "isKey": false }],
  "timeEntries": [{ "taskType": "DEVELOPMENT", "hours": 0 }],
  "notes": "", "links": []
}
```

Report response = `{ id, user: {id,name}, status, currentVersion, submittedAt, firstSubmittedAt, reviewedAt, latestReview?, content: ReportContent }`.
Snapshots are written only by `ReportSnapshotService` at submit time and are immutable.

## Auth
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/register | public | creates MEMBER; throttled |
| POST | /auth/login | public | sets httpOnly cookie; throttled; inactive users rejected |
| POST | /auth/logout | any | clears cookie |
| GET | /auth/me | any | current user |
| PATCH | /auth/me | any | update name |
| POST | /auth/change-password | any | current + new password |

## Users
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /users | ADMIN | paginated; filter role, isActive, search |
| POST | /users | ADMIN | create with role + temporary password |
| PATCH | /users/:id | ADMIN | name / role / isActive; last-active-admin and self-deactivate guards |
| DELETE | /users/:id | ADMIN | soft deactivate; same guards |
| GET | /users/team | MANAGER, ADMIN | active members with basic stats |
| GET | /users/:id/profile | MANAGER, ADMIN | member info + stats: counts by status, on-time rate, avg weekly spent hours |

On-time rate = reports with `firstSubmittedAt <= deadline` / reports with `firstSubmittedAt` not null. Avg hours = mean of summed `spentHours` over the member's SUBMITTED/APPROVED reports.

## Projects
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /projects | any | `includeArchived`; each item includes `isAssigned` for the caller |
| POST | /projects | MANAGER, ADMIN | |
| PATCH | /projects/:id | MANAGER, ADMIN | edit / archive |
| DELETE | /projects/:id | MANAGER, ADMIN | 409 if referenced by reports |
| PUT | /projects/:id/members | MANAGER, ADMIN | replace assigned member ids |

## Reports: member
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports/me | MEMBER | own history incl. drafts; filters status, from, to; sorted weekStart desc |
| POST | /reports | MEMBER | create draft `{ weekStart, projectId? }` |
| PATCH | /reports/:id | MEMBER (owner) | DRAFT / NEEDS_CORRECTION only; replaces all child rows in one transaction |
| DELETE | /reports/:id | MEMBER (owner) | DRAFT only |
| POST | /reports/:id/submit | MEMBER (owner) | DRAFT/NEEDS_CORRECTION → SUBMITTED; writes version |

## Reports: shared read
Owner: any own report (working copy). MANAGER/ADMIN: non-draft only (snapshot of `currentVersion`). Everyone else: 404.

| Method | Path | Notes |
|---|---|---|
| GET | /reports/:id | full report + latest review |
| GET | /reports/:id/versions | list: number, submittedAt, review summary |
| GET | /reports/:id/versions/:n | snapshot + reviews made against it |
| GET | /reports/:id/reviews | review comment history (each with versionNumber) |

## Reports: manager
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports | MANAGER, ADMIN | non-draft only; filters `weekStart`, `from`, `to`, `userId`, `projectId`, `status`; paginated |
| POST | /reports/:id/review | MANAGER, ADMIN | `{ action: APPROVED \| CHANGES_REQUESTED, comment? }`; only when SUBMITTED |
| GET | /team/week-status | MANAGER, ADMIN | `weekStart` → every eligible active member with status incl. `NOT_STARTED` (and `DRAFT`, status only) |
| GET | /team/sections | MANAGER, ADMIN | `weekStart`, `section=blockers\|achievements\|nextWeek\|notes` → side by side across members (SUBMITTED/APPROVED only) |

## Dashboard (MANAGER, ADMIN)
Eligible members for a week = active users with role MEMBER created on or before that week's `weekEnd`.

| Method | Path | Definition |
|---|---|---|
| GET | /dashboard/summary?weekStart | `totalSubmitted` = week's reports with `firstSubmittedAt` not null; `compliance` = `{ onTime, late, pending, eligible }` (see CLAUDE.md buckets); `needsCorrection` = reports with that status; `openBlockers` = unresolved blockers on SUBMITTED/APPROVED reports of the week |
| GET | /dashboard/tasks-trend?from&to&userId? | per week: count of tasks with status COMPLETED (SUBMITTED/APPROVED reports); team-wide or one user |
| GET | /dashboard/status-by-member?weekStart | per eligible member: status incl. NOT_STARTED, for a stacked/segmented chart |
| GET | /dashboard/workload-by-project?from&to | per project: task count and spent hours, via `report.projectId` |
| GET | /dashboard/time-by-type?from&to | hours per `TaskType` from `TimeEntry`, team-wide |
| GET | /dashboard/activity?limit | recent submissions (`ReportVersion.submittedAt`) and reviews (`Review.createdAt`), merged and sorted desc |

## Assistant (optional, last)
`POST /assistant/chat` (MANAGER, ADMIN). LLM tool-use calling existing services (never raw SQL, never user emails/passwords). Document the prompt design and privacy approach in the README.
