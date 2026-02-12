# VPS Deployment Architecture

## Overview

SpecVerse runs on a VPS with separate production and staging environments. Both environments use the same architecture pattern:

- **Production**: `prod-specverse.jeffabayon.com` (Next.js frontend) → proxies `/api/*` to backend
- **Staging**: `stage-specverse.jeffabayon.com` (Next.js frontend) → proxies `/api/*` to backend

## Ports

### Production
- Next.js frontend: **3000**
- Backend API server: **4000**

### Staging
- Next.js frontend: **3001**
- Backend API server: **4001**

## nginx Routing Contract

The nginx gateway routes requests as follows:

```
https://<domain>/api/* → backend on loopback port
```

- Production: `https://prod-specverse.jeffabayon.com/api/*` → `http://localhost:4000/api/*`
- Staging: `https://stage-specverse.jeffabayon.com/api/*` → `http://localhost:4001/api/*`

### Frontend API Calls

The frontend must call backend APIs using:

```
${NEXT_PUBLIC_API_BASE_URL}/api/backend/...
```

**Important**: Frontend must NOT hardcode `http://localhost:5000` or direct port calls (`:4000`/`:4001`). All requests go through the same-origin gateway.

## PM2 Configuration

### Restart Commands

Always restart with `--update-env` to ensure environment variables are refreshed:

```bash
pm2 restart specverse-prod --update-env
pm2 restart specverse-stage --update-env
```

### App Names

- Production: `specverse-prod` (or similar, as configured)
- Staging: `specverse-stage` (or similar, as configured)

These are separate PM2 apps, each with their own environment variables and port configuration.

## Verification Commands

### Health Checks

```bash
# Production backend health
curl https://prod-specverse.jeffabayon.com/api/health

# Staging backend health
curl https://stage-specverse.jeffabayon.com/api/health

# Production templates endpoint (requires auth)
curl -H "Cookie: token=<token>" https://prod-specverse.jeffabayon.com/api/backend/templates

# Staging templates endpoint (requires auth)
curl -H "Cookie: token=<token>" https://stage-specverse.jeffabayon.com/api/backend/templates
```

### Expected Responses

- `/api/health`: `{"status":"OK","message":"Backend server is running"}`
- `/api/backend/*`: JSON responses (requires authentication)

## Common Failure Modes

### Wrong NEXT_PUBLIC_API_BASE_URL

**Symptom**: Frontend API calls fail with CORS errors or 404s.

**Cause**: `NEXT_PUBLIC_API_BASE_URL` is not set or points to wrong domain.

**Fix**: Set `NEXT_PUBLIC_API_BASE_URL` to:
- Production: `https://prod-specverse.jeffabayon.com`
- Staging: `https://stage-specverse.jeffabayon.com`

### CORS Missing CORS_ALLOWED_ORIGINS

**Symptom**: Browser console shows CORS errors, requests blocked.

**Cause**: Backend `CORS_ALLOWED_ORIGINS` not configured.

**Fix**: Set `CORS_ALLOWED_ORIGINS` in backend `.env`:
- Production: `https://prod-specverse.jeffabayon.com`
- Staging: `https://stage-specverse.jeffabayon.com`

### Invite Base URL Missing

**Symptom**: Invite emails contain broken links or `localhost` URLs.

**Cause**: `INVITE_BASE_URL` or `NEXT_PUBLIC_APP_URL` not set in backend.

**Fix**: Set one of:
- `INVITE_BASE_URL=https://prod-specverse.jeffabayon.com` (preferred)
- `NEXT_PUBLIC_APP_URL=https://prod-specverse.jeffabayon.com` (fallback)

### Next.js Rewrites Active in Production

**Symptom**: Requests fail or timeout, backend not reachable.

**Cause**: `next.config.ts` rewrites still active when `NEXT_PUBLIC_API_BASE_URL` is set.

**Fix**: Ensure `NEXT_PUBLIC_API_BASE_URL` is set in production/staging. The rewrites are automatically disabled when this env var is present.

## Deployment Checklist

- [ ] `NEXT_PUBLIC_API_BASE_URL` set correctly for environment
- [ ] `CORS_ALLOWED_ORIGINS` includes frontend domain
- [ ] `INVITE_BASE_URL` or `NEXT_PUBLIC_APP_URL` set for invite links
- [ ] Database credentials configured (`DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`)
- [ ] `JWT_SECRET` set (different for prod/stage)
- [ ] `NODE_ENV=production` for production, `NODE_ENV=development` for staging
- [ ] `PORT` set correctly (4000 for prod, 4001 for stage)
- [ ] PM2 apps restarted with `--update-env`
