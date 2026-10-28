# Backend

NestJS API backed by PostgreSQL and Prisma. Run the API locally and PostgreSQL in Docker.

## Local development

From the repository root, start PostgreSQL and create your local environment file:

```powershell
docker compose up -d postgres
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Then, from `backend/`:

```powershell
npm ci
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

Set a unique `JWT_SECRET` with at least 32 bytes and `FRONTEND_ORIGIN=http://localhost:3000` in `.env` before starting the API. Generate a local secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.

To create the first admin and local demo fixtures, set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD`, and `DEMO_SEED_PASSWORD` in `.env`, then run `npm run seed`. The admin is created once and an existing admin account is not reset. Outside production, the command restores the dedicated demo accounts, five projects, project assignments, and eight weeks of sample reports to their canonical state. The demo manager and member accounts use the `DEMO_SEED_PASSWORD`; their emails end in `@example.test`. The demo password must be 15–72 UTF-8 bytes; do not reuse a real account password. Re-running the command resets demo-account passwords and sample report data.

Demo sign-in accounts created by the seed:

| Role    | Email                                                           |
| ------- | --------------------------------------------------------------- |
| Manager | `demo.manager@example.test`                                     |
| Member  | `demo.member1@example.test` through `demo.member5@example.test` |

Use the value configured as `DEMO_SEED_PASSWORD` for these accounts.

The seed command never creates demo data when `NODE_ENV=production`; it seeds only the configured initial admin and logs that demo data was skipped. Public registration can only create MEMBER accounts; only an ADMIN can grant MANAGER or ADMIN roles.

Authentication uses a one-day JWT in an `HttpOnly`, `SameSite=Lax` cookie. Production cookies use `Secure`; requests with browser Origin/Referer headers must match `FRONTEND_ORIGIN`. Sessions are stored in PostgreSQL so logout, password changes, and account deactivation revoke tokens immediately. Admin-created accounts must change their temporary password before using other protected routes.

The API listens on `http://localhost:3001/api/v1`. The database health endpoint is `http://localhost:3001/health`.

The Compose service publishes PostgreSQL on host port `5433`; `backend/.env.example` is configured to match. If that port is already in use on your machine, update both the Compose mapping and `DATABASE_URL` to the same host port.

## Checks

```powershell
npm run format:check
npm run lint
npm test
npm run build
```

The e2e suite needs a disposable database. GitHub Actions provides an isolated PostgreSQL service; no local test database service is configured.
