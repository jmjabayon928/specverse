# Environment Variables Reference

## Overview

This document lists all environment variables used by SpecVerse, organized by component (Frontend/Backend) and environment (Production/Staging).

## Frontend Environment Variables

| Name | Required? | Applies To | Example Placeholder | Notes |
|------|-----------|------------|---------------------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** (VPS) | Frontend | `https://prod-specverse.jeffabayon.com` | Base URL for API calls. Must match the frontend domain. In local dev, can be empty (uses Next.js rewrites). |
| `NEXT_PUBLIC_APP_URL` | No | Frontend | `https://prod-specverse.jeffabayon.com` | Used as fallback for invite base URL generation. Optional if `INVITE_BASE_URL` is set in backend. |

## Backend Environment Variables

| Name | Required? | Applies To | Example Placeholder | Notes |
|------|-----------|------------|---------------------|-------|
| `PORT` | No | Backend | `4000` (prod), `4001` (stage) | Port for backend server. Defaults to 5000 if not set. |
| `NODE_ENV` | **Yes** | Backend | `production` (prod), `development` (stage) | Environment mode. Affects CORS defaults, error handling, dev routes. |
| `DB_SERVER` | **Yes** | Backend | `your-db-server.database.windows.net` | SQL Server hostname. |
| `DB_DATABASE` | **Yes** | Backend | `SpecVerse_Prod` (prod), `SpecVerse_Stage` (stage) | Database name. Must differ between prod/stage. |
| `DB_USER` | **Yes** | Backend | `specverse_prod_app` (prod), `specverse_stage_app` (stage) | Database username. |
| `DB_PASSWORD` | **Yes** | Backend | `__REPLACE_ME__` | Database password. |
| `JWT_SECRET` | **Yes** | Backend | `__REPLACE_ME__` | Secret key for JWT token signing. Must be different for prod/stage. |
| `CORS_ALLOWED_ORIGINS` | **Yes** (VPS) | Backend | `https://prod-specverse.jeffabayon.com` (prod), `https://stage-specverse.jeffabayon.com` (stage) | Comma-separated list of allowed CORS origins. In local dev, defaults to localhost. |
| `INVITE_BASE_URL` | No | Backend | `https://prod-specverse.jeffabayon.com` | Base URL for invite acceptance links. Preferred over `NEXT_PUBLIC_APP_URL`. |
| `NEXT_PUBLIC_APP_URL` | No | Backend | `https://prod-specverse.jeffabayon.com` | Fallback for invite base URL if `INVITE_BASE_URL` not set. |
| `HOST_ENVIRONMENT` | No | Backend | `local`, `render`, `vercel` | Used to determine SQL Server `trustServerCertificate` setting. |
| `DEV_ADMIN_UTILS` | No | Backend | `1` | Enable dev admin utilities. Only works when `NODE_ENV !== 'production'`. |
| `SPECVERSE_DEBUG_FILLED_VALIDATE` | No | Backend | `1` | Enable debug logging for filled sheet validation. |
| `STRICT_FILLED_HEADER_GUARD` | No | Backend | `1` | Enable strict header update guard for filled sheets. |

## Production vs Staging Examples

### Production Environment

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://prod-specverse.jeffabayon.com
NEXT_PUBLIC_APP_URL=https://prod-specverse.jeffabayon.com

# Backend
PORT=4000
NODE_ENV=production
DB_SERVER=your-db-server.database.windows.net
DB_DATABASE=SpecVerse_Prod
DB_USER=specverse_prod_app
DB_PASSWORD=__REPLACE_ME__
JWT_SECRET=__REPLACE_ME__
CORS_ALLOWED_ORIGINS=https://prod-specverse.jeffabayon.com
INVITE_BASE_URL=https://prod-specverse.jeffabayon.com
HOST_ENVIRONMENT=vercel
```

### Staging Environment

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://stage-specverse.jeffabayon.com
NEXT_PUBLIC_APP_URL=https://stage-specverse.jeffabayon.com

# Backend
PORT=4001
NODE_ENV=development
DB_SERVER=your-db-server.database.windows.net
DB_DATABASE=SpecVerse_Stage
DB_USER=specverse_stage_app
DB_PASSWORD=__REPLACE_ME__
JWT_SECRET=__REPLACE_ME__
CORS_ALLOWED_ORIGINS=https://stage-specverse.jeffabayon.com
INVITE_BASE_URL=https://stage-specverse.jeffabayon.com
HOST_ENVIRONMENT=vercel
```

## Key Differences Between Prod and Stage

| Variable | Production | Staging |
|----------|-----------|---------|
| `PORT` | `4000` | `4001` |
| `NODE_ENV` | `production` | `development` |
| `DB_DATABASE` | `SpecVerse_Prod` | `SpecVerse_Stage` |
| `DB_USER` | `specverse_prod_app` | `specverse_stage_app` |
| `CORS_ALLOWED_ORIGINS` | `https://prod-specverse.jeffabayon.com` | `https://stage-specverse.jeffabayon.com` |
| `INVITE_BASE_URL` | `https://prod-specverse.jeffabayon.com` | `https://stage-specverse.jeffabayon.com` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://prod-specverse.jeffabayon.com` | `https://stage-specverse.jeffabayon.com` |

## Notes

- All `NEXT_PUBLIC_*` variables are exposed to the browser and must not contain secrets.
- Database passwords and JWT secrets must be different between prod and stage.
- `CORS_ALLOWED_ORIGINS` can contain multiple origins separated by commas.
- If `INVITE_BASE_URL` is not set, the backend will fall back to `NEXT_PUBLIC_APP_URL`. If neither is set, it will use the request origin (useful for local dev).
- `HOST_ENVIRONMENT` affects SQL Server connection security settings. Set to `vercel` for Azure-hosted databases.
