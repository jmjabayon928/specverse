# Phase 2.5 Account Context — Signoff

Concise checklist and verification steps for account-scoped API and App Router behavior.

---

## 1. Invariants

- **No production fallbacks for accountId**
  - Forbidden patterns: `accountId ?? 1`, `accountId || 1`, and **no** `getDefaultAccountId()` fallback in auth middleware for normal tenant requests. (Superadmin default-account use, if any, must be explicit and limited to platform/diagnostics.)
- **API:** Missing account context → **401**
  - Enforced via `mustGetAccountId(req, next)` or equivalent: if `req.user.accountId` is missing or invalid, respond 401 and do not proceed.
- **App Router:** Missing `session.accountId` → **notFound()**
  - Protected pages must check `session.accountId` and call `notFound()` when absent.
- **Single source of account context**
  - All account context comes from session/JWT + middleware (e.g. `attachAccountContext`). No userId-only tenant inference.

---

## 2. Pass/Fail Criteria

Sign-off **passes** only if all of the following hold:

- **Fallback patterns in src:** Ripgrep for accountId fallback patterns returns **0 hits** under `src/`. (Tests under `tests/` may use controlled defaults, e.g. explicit `TEST_ACCOUNT_ID` in setup.)
- **Backend route auth:** Every backend route is either **verifyToken**-protected (or **optionalVerifyToken** where documented) **or** explicitly listed in §2.1 Known Exceptions.
- **No getDefaultAccountId for normal auth:** There is **no** `getDefaultAccountId()` runtime fallback for normal tenant auth paths. Any use must be limited to superadmin/platform/diagnostics and documented.

### 2.1 Known Exceptions (explicit files)

The following files contain routes that are intentionally **public** or **optional-auth**; they are the only exceptions to verifyToken-on-every-route:

| File | Endpoint(s) | Auth |
|------|-------------|------|
| `src/backend/routes/labelRoutes.ts` | GET `/api/ui-labels` | Public (no verifyToken) |
| `src/backend/routes/languageRoutes.ts` | GET `/api/languages` (e.g. `/`) | Public (no verifyToken) |
| `src/backend/routes/exportJobsRoutes.ts` | GET `/:jobId/download` | optionalVerifyToken (token in query or session) |

All other route files under `src/backend/routes/` must use **verifyToken** on every route.

---

## 3. Required Greps (PowerShell)

Run from repo root. Use these to prove no fallbacks and no missing auth/account gates.

### 3.1 Account and tenant fallbacks (should be empty in production code)

```powershell
# No accountId fallbacks in src (run from repo root; exclude test files manually if needed)
Select-String -Path "src\**\*.ts" -Pattern "accountId \?\? 1|accountId \|\| 1"

# getDefaultAccountId: audit where it's used; only superadmin default-account path is acceptable
Select-String -Path "src\**\*.ts" -Pattern "getDefaultAccountId"
```

### 3.2 Routes missing verifyToken

```powershell
# List route definitions; then manually confirm each tenant route uses verifyToken or optionalVerifyToken
Get-ChildItem -Path src\backend\routes -Filter *.ts | ForEach-Object { Select-String -Path $_.FullName -Pattern "router\.(get|post|put|patch|delete)\s*\(" }
# See §2.1 Known Exceptions for the only files with public/optional-auth routes. All other route files must use verifyToken (or optionalVerifyToken only where documented).
```

### 3.3 mustGetAccountId usage and coverage

```powershell
# Where mustGetAccountId is used
Select-String -Path "src\**\*.ts" -Pattern "mustGetAccountId"
```

**Routes that intentionally do NOT need accountId:** See §2.1 Known Exceptions. All other API routes under `/api/backend/*` must run after verifyToken and have accountId from `req.user` (via attachAccountContext).

---

## 4. Route Checklist (by area)

For each area, confirm: **verifyToken present** + **accountId derived** (from `req.user` after middleware) + **accountId passed to service/db**.

| Area | Mount | verifyToken | accountId | Notes |
|------|--------|-------------|-----------|--------|
| **Datasheets / templates / filled** | templates, filledsheets, sheets (value sets, logs) | ✓ all | From req.user; controllers use sheetBelongsToAccount for sheet/template/revision IDs | |
| **Inventory** | /api/backend/inventory | ✓ all | mustGetAccountId in handlers that need it; else req.user.accountId | |
| **Valuesets / layouts** | valueSetRoutes, layoutRoutes | ✓ all | req.user.accountId; sheetBelongsToAccount for sheet/templateId | |
| **Exports / jobs** | /api/backend/exports/jobs | ✓ except download (optionalVerifyToken) | req.user.accountId where verifyToken | |
| **Reports / stats** | reports, stats | ✓ all | req.user.accountId | |
| **Settings (roles / permissions / users)** | settings/roles, permissions, users | ✓ all | req.user.accountId | |
| **Notifications** | /api/backend/notifications | ✓ all | req.user.accountId | |
| **Auth** | /api/backend/auth | ✓ session, me | N/A (session) | |
| **Admin / audit** | admin, audit-logs | ✓ + requireAdmin | req.user.accountId | |
| **Public (no account)** | labelRoutes (/api), languageRoutes (/api/languages) | No | N/A | Label and language endpoints only. |

---

## 5. Ownership Gates

- **sheetBelongsToAccount** (or equivalent) is **required** for any endpoint that takes `sheetId`, `templateId`, or `revisionId`. The handler must resolve accountId (from req.user), then call `sheetBelongsToAccount(id, accountId)` before performing the operation; on false, return 403/404.
- **syncSubsheetTree** must only be reachable after an ownership gate (e.g. called from code paths that already verified the sheet/template belongs to the account). It must not be callable with an arbitrary sheetId without that check.

---

## 6. RBAC Keys

- **Single canonical list:** `src/constants/permissions.ts`.
- Backend `requirePermission(...)` and frontend `SecurePage` (or equivalent) must use keys from this list (or from the same source).
- No stray keys (e.g. ad-hoc strings like `TEMPLATE_VERIFY` used only in one place) unless they are defined and mapped in the canonical list. All permission keys in use should appear in `PERMISSIONS` (or the same constants module).

---

## 7. Test Policy (short)

- Tests may **mock** auth and ownership gates (e.g. mock `verifyToken`, `sheetBelongsToAccount`).
- Prefer tokens that **include accountId explicitly** in the payload; avoid silent defaults (e.g. no `decoded.accountId ?? 1`) in new tests. Use an explicit test constant (e.g. `TEST_ACCOUNT_ID`) in setup when a default is needed.

---

## 8. Final Local Verification (human instructions)

1. Run the PowerShell greps in §3 and fix any violations (no accountId fallbacks in production; no routes missing verifyToken where required).
2. Spot-check one route per area in §4: confirm verifyToken (or optionalVerifyToken) and that accountId is taken from req.user and passed to the service/db.
3. For one sheet/template/revision endpoint (see §5), confirm a `sheetBelongsToAccount` (or equivalent) check before the operation.
4. Confirm `src/constants/permissions.ts` contains every permission key used by `requirePermission` and by frontend gating.
5. Run the full test suite and fix any failures.

Do not rely on automated run results in this doc; perform these steps locally and sign off when satisfied.

---

## 9. Empty lists (Templates / Filled Sheets)

If Templates or Filled Sheets list pages are empty after multi-account scoping, the usual cause is **data**, not app code: list queries filter by `Sheets.AccountID`, so rows with `AccountID IS NULL` (or a different account than the logged-in user’s) return no results.

**Fix path:**

1. **Run diagnostics** (read-only) to confirm NULLs or mismatched account:
   - Use `docs/phase2.5-diagnostics-sheets-accountid.sql` (counts and samples for `Sheets.AccountID` and the default account).
2. **If any `Sheets.AccountID IS NULL`:**
   - Run the existing backfill: `migrations/phase2_5_bundle2_backfill_accountid.sql`.
   - It sets `AccountID = (SELECT AccountID FROM dbo.Accounts WHERE Slug = N'default')` for all NULL rows. Safe and idempotent; the default account is the single-tenant account created by Bundle 1.
3. **Verify the dev user’s accountId:**
   - The app resolves `req.user.accountId` from session/JWT and `attachAccountContext` (e.g. `getAccountContextForUser(userId)` or default account for superadmin). Ensure the logged-in user has a row in `AccountMembers` for the same account as the backfilled Sheets (typically AccountID = 1 for the default account).

**Exact commands (PowerShell; adjust server/database/auth for your environment):**

Replace `-d DataSheets` with your local database name if different.

```powershell
# 1) Diagnostics (read-only). Inspect output and the "Next step" row at the end.
sqlcmd -S . -d DataSheets -E -i docs/phase2.5-diagnostics-sheets-accountid.sql

# 2) If backfill needed: run Phase 2.5 Bundle 2 backfill (requires Bundle 1 applied first).
sqlcmd -S . -d DataSheets -E -i migrations/phase2_5_bundle2_backfill_accountid.sql

```

Use `-S YourServer` and `-U user -P password` instead of `-E` if not using Windows auth.
