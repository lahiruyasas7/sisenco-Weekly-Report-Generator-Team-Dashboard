# Frontend

Next.js App Router client for the weekly report generator.

## Local development

From the repository root, copy the frontend environment template:

```powershell
if (-not (Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

Then, from `frontend/`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. The `BACKEND_URL` setting points to the NestJS API; requests to `/api/v1/*` are rewritten to that backend origin.

## Checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
```
