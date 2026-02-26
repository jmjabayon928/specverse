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

### Frontend API Calls (cloud-first)

SpecVerse is **cloud-first**: the frontend uses **relative** paths for all backend calls:

```
/api/backend/...
```

All requests go through the same-origin gateway (Next.js or nginx). Do **not** hardcode `http://localhost:5000` or direct port calls (`:4000`/`:4001`). `NEXT_PUBLIC_API_BASE_URL` is **not required** for same-origin deployments and is legacy/optional only.

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

### CORS or 404 on API calls

**Symptom**: Frontend API calls fail with CORS errors or 404s.

**Cause**: Usually CORS or routing. With cloud-first routing, the frontend uses relative `/api/backend/...`; ensure nginx (or Next.js) proxies those paths to the backend. Ensure `CORS_ALLOWED_ORIGINS` includes the frontend origin.

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

### Next.js rewrites vs nginx

**Symptom**: Requests fail or timeout, backend not reachable.

**Cause**: With nginx in front, set `USE_NGINX_PROXY=true` for the Next.js app so Next.js rewrites are disabled and nginx handles routing to the backend. The frontend uses relative `/api/backend/...`; no `NEXT_PUBLIC_API_BASE_URL` is required for same-origin.

## Deployment Checklist

- [ ] `CORS_ALLOWED_ORIGINS` includes frontend domain
- [ ] `BACKEND_TRUST_PROXY=true` set for backend when behind nginx/TLS
- [ ] `INVITE_BASE_URL` or `NEXT_PUBLIC_APP_URL` set for invite links
- [ ] Database credentials configured (`DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`)
- [ ] `JWT_SECRET` set (different for prod/stage)
- [ ] `NODE_ENV=production` for production, `NODE_ENV=development` for staging
- [ ] `PORT` set correctly (4000 for prod, 4001 for stage)
- [ ] PM2 apps restarted with `--update-env`
