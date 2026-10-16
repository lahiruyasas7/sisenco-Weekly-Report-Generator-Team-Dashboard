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
