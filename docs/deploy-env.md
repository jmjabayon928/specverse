## Principles

- **Cloud-first (one origin)**: the frontend calls **only** relative URLs under `/api/backend/*`. Do **not** set `NEXT_PUBLIC_API_BASE_URL`; one browser origin per environment.
- **Runtime secrets only**: no `.env` or `.env.local` in the VPS/build directory. Secrets are injected at runtime via PM2, systemd, or Render env vars. `.env.example` documents keys only (no values).
- **Cookie-based auth**: session is an HttpOnly cookie (`sid`). `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Reverse proxy required**: nginx (or Next.js rewrites when not using nginx) must route `/api/backend/*` to the Express backend.

## Backend required env (names only)

`NODE_ENV`, `SPECVERSE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Next/server proxy: `BACKEND_INTERNAL_ORIGIN`. See `.env.example` and sections below for meaning.

## Optional env

- `AUTH_DEBUG=1` — enable auth request logging (session/login paths). Leave unset in production.
- `BACKEND_TRUST_PROXY` — set to `1` to trust upstream proxy when not auto-detected.

## Required runtime env (Backend)

Backend (Express) expects the following environment variables at runtime:

- **`NODE_ENV`**: `development`, `test`, or `production`. Controls framework behavior and some safety checks.
- **`SPECVERSE_ENV`**: high-level environment indicator (`local`, `staging`, `production`, etc.). Used for proxy trust and logging behavior.
- **`JWT_SECRET`**: secret signing key for JWT-based sessions. Must be **strong** and never committed to git. Example in `.env.example` uses `CHANGEME` placeholder only.
- **`JWT_EXPIRES_IN`**: JWT lifetime (e.g. `60m`). Controls how long issued tokens are valid.
- **Database connection env**: the backend reads its database connection settings from environment variables (host, port, user, password, database name). These values are deployment-specific and must be provided by your process manager or hosting platform. See `.env.example` for placeholder names; do not commit real credentials.
- **`BACKEND_TRUST_PROXY`** (optional override): when set to `1`/`true`, forces Express to trust the upstream proxy even if `SPECVERSE_ENV` is not `staging`/`production`. In staging/production, trust is enabled automatically based on `NODE_ENV`/`SPECVERSE_ENV`.

Backend must run with these values injected by the runtime (e.g. PM2 `--env`, systemd unit `Environment=`, Render/Heroku config vars). `.env.local` or `.env` files should not be committed.

## Required runtime env (Next / app server)

The Next.js app server needs to know how to reach the backend internally:

- **`BACKEND_INTERNAL_ORIGIN`** (server-only)
  - **Local development**: `http://localhost:4000`
  - **Staging/production**: an internal-only URL such as `http://127.0.0.1:4000` or whatever port your Express backend listens on inside the container/VM.
  - This value is used by `src/app/api/backend/[...path]/route.ts` to proxy `/api/backend/*` calls to the Express backend.
  - It must **not** be exposed directly to the browser (no `NEXT_PUBLIC_` prefix).

Other Next.js runtime envs (feature flags, analytics, etc.) should be managed the same way: set at runtime, never committed with real values, and only prefixed with `NEXT_PUBLIC_` when they are intentionally safe for the browser.

## Reverse proxy rules

### Staging / Production (nginx or equivalent)

At the edge (nginx, Traefik, load balancer, etc.), configure routing so that:

- `GET/POST/... /` and all non-API paths go to the Next.js app server.
- **`/api/backend/*`** is forwarded to the Express backend upstream.

A typical nginx snippet:

```nginx
location /api/backend/ {
  proxy_pass http://127.0.0.1:4000;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header Host $host;
}
```

The Express app is configured to **trust the proxy** in production/staging so that `req.secure` and cookie `Secure` behavior are correct when TLS terminates at nginx.

### Local development

In local dev, the Next.js route handler at `src/app/api/backend/[...path]/route.ts` proxies browser requests under `/api/backend/*` to the backend defined by `BACKEND_INTERNAL_ORIGIN`. No extra nginx configuration is required; both the app and backend can run on localhost.

## Verification checklist

After deploying to a new environment (staging or production), validate the following from the **app origin** (the Next.js host):

1. **Backend health**
   - `curl https://<app-origin>/api/backend/filledsheets/health`
   - Expect `{"ok": true}` (or equivalent health payload) with a `200` status.

2. **Login sets HttpOnly cookie**
   - Log in through the browser.
   - Inspect the network tab: the `/api/backend/auth/login` response should include a `Set-Cookie` header for the session token with `HttpOnly`, `SameSite=Lax`, and `Secure` (in HTTPS environments).

3. **Session endpoint works with cookie**
   - Using the same browser session, call `/api/backend/auth/session`.
   - Expect `200` and a JSON body describing the current user/session.

4. **Invite accept-public auto-login**
   - Open a valid invite accept link (e.g. `/invite/accept?token=...`).
   - Complete the **public accept** flow.
   - Verify that:
     - The backend returns `200` from `/api/backend/invites/accept-public`.
     - A session cookie is set.
     - The UI lands on `/dashboard` and remains authenticated on refresh.

5. **Proxy path sanity**
   - From the app host, ensure that all authenticated API calls use `/api/backend/*` and succeed when the user has a valid session.

