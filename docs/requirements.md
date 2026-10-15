# Requirements: Weekly Report Generator & Team Dashboard

**Document status:** Initial draft for implementation  
**Source:** Technical SE Assignment - *Weekly Report Generator & Team Dashboard* (7 pages), plus the architecture and implementation decisions discussed before creating this document.  
**Purpose:** Define the product behavior and acceptance criteria before implementation begins.

## 1. Product overview

Build a full-stack internal web application where team members prepare a consistent weekly work report and submit it to a manager. Managers review reports, approve them or request corrections, and use a team dashboard to understand submissions, completed work, blockers, project distribution, and time spent.

The application must use real persisted data. The report workflow, permissions, and history are core functionality; the dashboard must not rely on hard-coded presentation data.

### 1.1 Goals

- Provide the same fixed weekly report structure to every team member.
- Support a complete review cycle: draft, submit, request correction, edit, resubmit, and approve.
- Enforce role-based and record-level permissions in the backend.
- Preserve submitted report versions and link review actions to the version being reviewed.
- Give managers useful filters, summary metrics, charts, and recent activity.
- Deliver a maintainable, testable codebase that can be explained and changed during a live coding round.

### 1.2 Scope boundaries

**In scope:** authentication, authorization, weekly reports, tasks, blockers, achievements, work-hour summaries, report version and review history, projects/categories, manager/admin views, dashboards, validation, automated tests, seed data, setup documentation, and deployment preparation.

**Out of scope for this implementation plan:** preparing the assignment presentation or recording the demo video. These deliverables are intentionally excluded from this requirements file because the current development focus is the application itself.

The AI assistant is optional and is not part of the initial required scope. It should only be considered after the core workflow and required views are complete.

## 2. User roles and permissions

The assignment identifies Team Member and Manager/Admin capabilities. This implementation separates Manager and Admin for clearer authorization.

| Capability | Team Member | Manager | Admin |
|---|---|---|---|
| Register and manage own account/session | Yes | Yes | Yes |
| Create and edit own draft reports | Yes | No by default | No by default |
| Edit reports returned for correction | Yes, own reports only | No | No |
| Submit/resubmit own reports | Yes, own reports only | No | No |
| View own report history and details | Yes | Yes | Yes |
| View reports from all team members | No | Yes | Yes |
| Approve or request corrections on submitted reports | No | Yes | Yes |
| Change report content written by a team member | No | No | No |
| Manage projects/categories | No | Yes, proposed default | Yes |
| Manage users and assign roles | No | No | Yes |
| View team dashboard and analytics | No | Yes | Yes |

### Authorization rules

- Every protected API request must authenticate the caller and authorize the requested action on the server.
- A team member may only read or modify their own report and its editable child records.
- A team member must not be able to access manager/admin endpoints by changing a URL, request body, or identifier.
- Managers can read team reports and perform review actions, but cannot edit the member-authored report content.
- Only admins can assign privileged roles or manage users.
- **Proposed registration rule:** public self-registration creates a Team Member account. Users must not be able to choose Manager or Admin for themselves.
- Role checks must be based on the authenticated identity and persisted role, not a role value supplied by the client.

## 3. Functional requirements

Requirement IDs are included to make implementation, testing, and review traceable.

### 3.1 Authentication and account management

- **AUTH-01 — Registration:** A visitor can register an account using the fields defined for the application.
- **AUTH-02 — Login:** A registered user can authenticate and access the pages permitted by their role.
- **AUTH-03 — Logout:** A user can end their session.
- **AUTH-04 — Password protection:** Passwords must be securely hashed; plaintext passwords must never be stored or logged.
- **AUTH-05 — Secure sessions:** Session credentials must be handled securely. Browser session cookies should use appropriate `HttpOnly`, `Secure` (in production), and `SameSite` settings.
- **AUTH-06 — Role assignment:** Admins can assign or change roles. Public registration must not grant elevated privileges.
- **AUTH-07 — Protected routes:** Protected frontend pages and backend endpoints must enforce authentication; backend authorization is authoritative.
- **AUTH-08 — Account administration:** Admins can view users, invite or add team members, remove/deactivate team members, and assign roles. The exact invitation mechanism can be chosen during implementation.

### 3.2 Weekly report structure

Each report must use a fixed, consistent structure. Team members cannot add, remove, reorder, or customize report sections or fields.

- **REPORT-01 — Reporting week:** Store the week/date range covered by the report.
- **REPORT-02 — Project/category:** Associate the report with a project or work category.
- **REPORT-03 — Completed tasks:** Support a task-level table with these fields:
  - Task name
  - Priority
  - Planned completion percentage
  - Actual completion percentage
  - Task status
  - Planned time
  - Time spent
  - Output/deliverable produced
- **REPORT-04 — Next week's plan:** Record tasks planned for the following week.
- **REPORT-05 — Blockers/challenges:** Record one or more blockers and allow one blocker to be flagged as the key issue for the week.
- **REPORT-06 — Achievements/highlights:** Record one or more achievements and allow one achievement to be flagged as the key achievement for the week.
- **REPORT-07 — Work hours:** Optionally record hours by task type, such as Development, Testing, Meetings, and Documentation.
- **REPORT-08 — Notes and links:** Allow optional notes and relevant links.
- **REPORT-09 — Create draft:** Creating a report saves it as Draft before submission.
- **REPORT-10 — Edit permissions:** A member can edit a report only while it is Draft or Needs Correction.
- **REPORT-11 — Submit:** A member can submit an eligible report for manager review.
- **REPORT-12 — Own report history:** A member can list their previous reports by week and see each report's current status.
- **REPORT-13 — Report detail:** A read-only report-detail view is available to the owner and users authorized to review team reports.
- **REPORT-14 — Consistent schema:** Report fields and their order remain the same for all team members.

### 3.3 Report status and review workflow

Allowed statuses are:

- `DRAFT` — A team member is preparing the report. Draft content is visible only to its owner. To satisfy dashboard status tracking, a manager may see that the member is in Draft status, but must not be able to open or read the draft content.
- `SUBMITTED` — The member has submitted the report and it is available to managers for review.
- `NEEDS_CORRECTION` — A manager has returned the report with a comment. The member can edit and resubmit it.
- `APPROVED` — A manager has approved the report. It is read-only to the member and cannot be reopened through ordinary report editing.

Required transitions:

| Current status | Action | Next status | Actor |
|---|---|---|---|
| Draft | Submit | Submitted | Report owner |
| Submitted | Approve | Approved | Manager/Admin |
| Submitted | Request changes with a comment | Needs Correction | Manager/Admin |
| Needs Correction | Resubmit after editing | Submitted | Report owner |

Rules:

- **WORKFLOW-01:** The backend must enforce the allowed transitions. Invalid transitions return an appropriate client error and do not modify the report.
- **WORKFLOW-02:** Requesting changes requires a non-empty general review comment.
- **WORKFLOW-03:** The latest manager comment must be clearly visible to the report owner when correction is required.
- **WORKFLOW-04:** Managers/Admins can change review status and create review comments, but cannot rewrite the member-authored report content through review endpoints.
- **WORKFLOW-05:** After resubmission, the report returns to Submitted and becomes available for another review.
- **WORKFLOW-06:** Approved reports are read-only under the normal workflow.
- **WORKFLOW-07:** Review actions must record who acted, when they acted, the action taken, and the version reviewed.
- **WORKFLOW-08:** Keep an immutable snapshot of the submitted report content for each submission. A correction and resubmission creates a new version rather than overwriting the previous submitted version.
- **WORKFLOW-09:** Managers can view past submitted versions on demand and identify which version each review comment/action refers to. A full visual diff is not required.
- **WORKFLOW-10:** Preserve review history. The assignment explicitly makes previous-comment history optional, but version history is described as a required behavior; implement the version-linked review history as the safer interpretation.

### 3.4 Manager team dashboard

- **DASH-01 — Selected week:** Managers can view team reports for a selected week.
- **DASH-02 — Team member filter:** Filter by team member.
- **DASH-03 — Project/category filter:** Filter by project or category.
- **DASH-04 — Date filter:** Filter by a date range.
- **DASH-05 — Status tracking:** Show each team member's reporting state for the selected period: Draft, Submitted, Needs Correction, Approved, or Not Yet Started. For Draft, show status only; do not expose the draft's content to managers.
- **DASH-06 — Report review:** Managers can open a report, inspect its full content and past submitted versions, then approve it or request changes.
- **DASH-07 — Submitted count:** Show the total reports submitted for the relevant week.
- **DASH-08 — Compliance:** Show submission compliance, including submitted, pending, and late reporting.
- **DASH-09 — Corrections:** Show the number of reports currently in Needs Correction.
- **DASH-10 — Blockers:** Show the number of open blockers across the team.
- **DASH-11 — Completed-task trend:** Display completed-task trends over time, per person or team-wide.
- **DASH-12 — Status visualization:** Visualize report submission/approval statuses by team member.
- **DASH-13 — Project distribution:** Visualize workload or task distribution by project.
- **DASH-14 — Time distribution:** Visualize time spent by task type across the team when optional time data exists.
- **DASH-15 — Recent activity:** Show recent reports and review activity, including approval and correction actions.
- **DASH-16 — Real data:** Dashboard summaries and charts must be calculated from persisted application data and respond to active filters.
- **DASH-17 — Section comparison (bonus):** For a selected week, optionally compare a section such as blockers or achievements across team members without opening every report individually.

### 3.5 Projects and categories

- **PROJECT-01:** An authorized Manager/Admin can create a project/category.
- **PROJECT-02:** An authorized Manager/Admin can edit a project/category.
- **PROJECT-03:** An authorized Manager/Admin can delete a project/category, subject to a safe policy for existing report references.
- **PROJECT-04:** Reports can reference a project/category.
- **PROJECT-05 (optional):** Assign team members to relevant projects.
- **PROJECT-06:** Project/category management must have a dedicated page with a list and CRUD actions, not only a modal.

### 3.6 Required pages/views

The assignment requires at least seven of the following views to be implemented and connected to real backend data. The implementation target is to complete all listed views, plus the team dashboard, to avoid scope ambiguity.

1. Login and Register
2. Personal weekly report create/edit page
3. Personal report history page, separate from the create/edit page
4. Read-only report detail page, shared by members and managers according to permissions
5. Team member profile page for managers, including report history and basic statistics
6. Project/category management page with list and CRUD actions
7. Admin user-management page for inviting/removing members and assigning roles
8. Manager review page with Approve and Request Changes actions and a comment field
9. Manager team dashboard with filters, metrics, charts, and recent activity

The UI must be responsive, component-based, use reusable components, have a clear page/folder structure, and provide basic client-side form validation. Backend validation remains required even when client-side validation exists.

### 3.7 Optional AI assistant

AI is a good-to-have enhancement, not a core acceptance requirement. Possible features include manager Q&A about team activity or an AI-generated summary of completed work, recurring blockers, and workload imbalance.

Do not start this feature until authentication, the complete report workflow, version history, required views, dashboard data, and automated tests are working. If implemented later, document the chosen approach, prompt design, data access boundaries, and privacy considerations. Do not expose data the requesting user is not authorized to see to the AI service.

## 4. Technical and data requirements

### 4.1 Proposed implementation baseline

The assignment allows the candidate to choose the stack. Based on the prior architecture discussion, the proposed baseline is:

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, React Hook Form, and TanStack Query.
- **Backend:** NestJS REST API with clear controller, DTO, guard, and service responsibilities.
- **Database:** PostgreSQL with Prisma ORM and migrations.
- **Charts:** Recharts or another suitable charting library.
- **Testing:** Unit/integration tests for services and APIs, with emphasis on authorization and workflow behavior.

These are implementation choices, not technology mandates from the assignment. Revisit them only if a concrete requirement or deployment constraint justifies a change.

### 4.2 Backend/API requirements

- **API-01:** Expose the application's backend operations through a REST API.
- **API-02:** Validate and normalize incoming request data using server-side DTO/schema validation.
- **API-03:** Enforce authentication, role authorization, report ownership, and workflow rules on the backend.
- **API-04:** Use clean controller/service separation; controllers should not contain the core business workflow logic.
- **API-05:** Paginate and/or filter every endpoint that returns a report list. Apply pagination/filtering to other potentially large lists where appropriate.
- **API-06:** Use appropriate HTTP status codes and consistent error responses without leaking secrets or stack traces.
- **API-07:** Prevent mass assignment by allowing only fields that are valid for the current action. Manager review endpoints must not accept report-content fields.
- **API-08:** Use database transactions for multi-write operations that must succeed or fail together, including submission/version/review actions where applicable.

### 4.3 Data model requirements

The schema must clearly represent users, roles, projects, reports, and review/status history. The proposed logical entities are:

- `User` — identity, credential hash, role, account status, timestamps.
- `Project` or `Category` — name, description/metadata as needed, active/deleted state as appropriate.
- `WeeklyReport` — owner, reporting week/date range, project/category, current status, optional notes/links, timestamps, and the current/latest review state needed by the UI.
- `ReportTask` — completed task name, priority, planned/actual completion percentage, task status, planned/spent time, and deliverable.
- `NextWeekTask` — task or planned-work description associated with a report.
- `Blocker` — blocker description and key-issue flag.
- `Achievement` — achievement description and key-achievement flag.
- `WorkHour` — hours grouped by task type; optional report data.
- `ReportVersion` — immutable snapshot of a submitted report, submission timestamp, and version number/identifier.
- `ReviewAction` — reviewer, reviewed version, action, optional/required comment depending on action, and timestamp.

This is a logical starting point, not a final physical schema. Choose normalization and relation details during data-model design, while preserving the behavior above.

### 4.4 Data integrity

- **DATA-01:** Define a unique reporting period per member so duplicate reports for the same week cannot be created accidentally. Proposed default: unique `(ownerId, weekStart)`.
- **DATA-02:** Enforce valid status values and referential integrity in the database where practical.
- **DATA-03:** Ensure there is at most one key blocker and at most one key achievement per report. This is a proposed interpretation; the assignment does not specify whether a key item must always be selected.
- **DATA-04:** Validate percentage fields to an agreed range, expected to be 0-100.
- **DATA-05:** Validate numeric time/hour values as non-negative and define their units consistently.
- **DATA-06:** Keep submitted snapshots and review history immutable through the normal application workflow.
- **DATA-07:** Define a safe policy for project/category deletion when existing reports refer to it; do not silently orphan historical report data.

## 5. Security, privacy, and reliability requirements

- **SEC-01:** Store password hashes, never plaintext passwords.
- **SEC-02:** Apply server-side authentication and authorization to every protected API.
- **SEC-03:** Protect against insecure direct object references by checking report ownership/permissions for every read and write.
- **SEC-04:** Use secure session handling and do not store session/access tokens in browser local storage as the default design.
- **SEC-05:** Validate inputs on the server and avoid trusting client-supplied user IDs, roles, current statuses, or reviewer identities.
- **SEC-06:** Keep secrets in environment variables or a secrets manager; do not commit `.env` files containing credentials.
- **SEC-07:** Do not log passwords, session credentials, or unnecessary sensitive report content.
- **SEC-08:** Use transactions and database constraints to prevent partially completed workflow operations.
- **SEC-09:** Use understandable loading, empty, validation, success, and error states in the UI; avoid presenting failed requests as successful.
- **SEC-10:** Document environment setup, migrations, seeding, test execution, and deployment configuration in the README.

## 6. Seed data and automated testing

### Seed data

- **TESTDATA-01:** Seed at least 3-5 team members and several weeks of reports.
- **TESTDATA-02:** Include reports in different statuses so the dashboard shows meaningful variations.
- **TESTDATA-03:** Include representative projects/categories, tasks, blockers, achievements, work-hour records, and review history.
- **TESTDATA-04:** Provide development/demo credentials through documented local-only seed setup, without using real user credentials or production secrets.

### Automated tests

- **TEST-01:** Include at least one automated test for role-based access control; this is strongly recommended by the assignment and is required by this project plan.
- **TEST-02:** Verify a team member cannot read or edit another member's report.
- **TEST-03:** Verify a team member cannot call manager/admin review endpoints.
- **TEST-04:** Verify invalid workflow transitions are rejected.
- **TEST-05:** Verify Request Changes requires a comment and updates the report status.
- **TEST-06:** Verify resubmission creates a new version and retains the previous submitted snapshot/review association.
- **TEST-07:** Verify a manager can approve/request changes for a submitted report but cannot change report content.
- **TEST-08:** Verify list endpoints enforce pagination/filtering and ownership/role scopes.
- **TEST-09:** Cover core happy paths and important error cases for authentication, report creation, submission, review, and dashboard summaries.

## 7. Non-functional requirements

- **NFR-01 — Maintainability:** Use clear module boundaries, descriptive names, small testable service methods, and reusable UI components.
- **NFR-02 — Responsive UI:** Required views should work on desktop and common mobile/tablet viewport sizes.
- **NFR-03 — Usability:** Users can easily identify report status, required actions, review comments, validation errors, and relevant filters.
- **NFR-04 — Consistency:** Use a fixed report structure and consistent status/field terminology throughout the application.
- **NFR-05 — Data correctness:** Dashboard values and report history must reflect persisted data and selected filters.
- **NFR-06 — Testability:** Business rules, permissions, and status transitions must be testable without relying solely on browser-level tests.
- **NFR-07 — Documentation:** The repository README must explain dependency installation, frontend startup, backend startup, database startup/configuration, migrations, seeding, and tests.
- **NFR-08 — Deployment readiness:** Configuration must support a deployed instance without committing secrets. Public deployment is a bonus in the assignment; target it if time and hosting constraints permit.

## 8. Acceptance criteria / definition of done

The application is functionally ready for review when all of the following are true:

- [ ] A user can register, log in, and log out securely.
- [ ] Public registration cannot grant Manager/Admin privileges.
- [ ] A team member can create a draft report using the fixed report structure.
- [ ] A team member can edit a draft, submit it, and see it in their report history.
- [ ] A manager can find the submitted report on the team dashboard and open its details.
- [ ] A manager can approve a submitted report.
- [ ] A manager can request changes with a mandatory comment, and the member can clearly see that comment.
- [ ] The member can edit the returned report and resubmit it.
- [ ] Resubmission retains the earlier submitted version and links reviews to the version reviewed.
- [ ] A manager can view past versions and review history without editing member-authored report content.
- [ ] A member cannot access another member's report by guessing/changing an ID or calling the API directly.
- [ ] Manager-only and admin-only operations reject unauthorized callers.
- [ ] Project/category CRUD exists on a dedicated page and reports can be associated with a project/category.
- [ ] The required views are connected to real backend data; the implementation target is all eight views listed in Section 3.6, plus the manager dashboard.
- [ ] Dashboard filters and summary metrics work against persisted data.
- [ ] Dashboard charts and activity feed display data from the seeded or user-created reports.
- [ ] Seed data contains at least 3-5 team members and several weeks of reports in different states.
- [ ] Automated authorization and workflow tests pass.
- [ ] The README enables another developer to configure, run, seed, and test the application.

## 9. Assumptions and decisions to confirm

The assignment leaves some operational details open. To avoid blocking initial development, use the proposed defaults below and record any later changes.

| Topic | Proposed default | Why it needs confirmation |
|---|---|---|
| Public registration | New accounts receive the Team Member role; Admin assigns elevated roles | The assignment allows role assignment at signup or by an admin but does not specify the onboarding policy. |
| Reporting week | Use a consistent configured week start and store its date range; proposed unique key is owner plus week start | The assignment does not define the week boundary or timezone. |
| Submission deadline | Define a configurable weekly deadline for calculating late submissions | Compliance metrics require a deadline, but no deadline is provided. |
| Compliance formula | Define the denominator as eligible team members for the selected period; classify each as submitted/on time, pending, or late using the configured deadline | The assignment names the metric but does not provide its formula. Avoid counting a member more than once. |
| “Open blocker” | Treat a blocker as open until explicitly marked resolved; add a resolution field/status if this metric is used | The assignment requires an open-blocker count but does not define how blockers close. |
| Task priorities/statuses | Use controlled enumerated values selected during UI/data-model design | The assignment requires both fields but does not give their allowed values. |
| Projects/categories | Start with report-level project/category association; support member assignment only if time permits | Project/category association is required, but assignment to relevant members is optional. |
| Key blocker/achievement | Allow at most one flagged item in each section; do not require a key selection unless confirmed | The assignment allows one item to be flagged but does not say it is mandatory. |
| Editing approved reports | Keep approved reports immutable in the normal workflow | The assignment says no further edits are expected but does not specify an admin reopen procedure. |
| Removal and deletion | Prefer deactivation/archival when deletion would break report or audit history | The assignment requires removing users and deleting projects/categories but does not define historical-data behavior. |
| Deployment | Aim for a public deployment after the core implementation is stable | Deployment is a bonus, not a hard requirement. |
| AI assistant | Defer until the core workflow and required views are complete | AI is explicitly optional. |

## 10. Implementation priorities

1. Finalize requirements, status transitions, authorization matrix, and reporting-period assumptions.
2. Design the ER diagram and Prisma schema; create and apply the initial migration.
3. Implement authentication and role/ownership authorization, with automated tests.
4. Implement the end-to-end report lifecycle and immutable submitted versions/review history.
5. Build the member report form, report history/detail views, and manager review flow against the real API.
6. Build projects/categories and user management.
7. Build the manager dashboard, filters, metrics, charts, and activity feed.
8. Complete seed data, required views, error/loading states, broader test coverage, README, and deployment readiness.
9. Consider optional AI assistance only after the core acceptance criteria pass.

---

**Source discipline:** The functional scope and explicit evaluation requirements above are taken from the assignment PDF. Items labelled as proposed defaults, implementation choices, non-functional expectations, or assumptions are engineering decisions to make the requirements actionable; they should not be mistaken for additional mandates written by the assignment author.
