# Phase 2.5 — Account context and session

How the active account is stored, how the backend resolves it on each request, how permissions are evaluated, and common failure modes.

---

## 1. How active account is stored (UserActiveAccount)

- **Table:** `dbo.UserActiveAccount` (one row per user: `UserID` PK, `AccountID`, `UpdatedAt`).
- **Written by:** `POST /api/backend/sessions/active-account` with body `{ accountId }`. The backend validates that the user has an active membership in that account, then upserts the row (or clears if switching to a fallback).
- **Read by:** Middleware `attachAccountContext` uses `getStoredActiveAccountId(userId)` to get the user’s stored active account before resolving role/permissions.
- **Cleared when:** Stored account is invalid (user no longer has active membership); then fallback selection is used and the row is deleted.

---

## 2. How attachAccountContext resolves account (stored → fallback)

Runs after JWT verification on every request that uses `verifyToken`. Order:

1. **Superadmin header override** (platform/diagnostics only)  
   If `x-specverse-account-id` is present and the user is a platform superadmin, the account is set from that header (and must exist and be active). Used for platform/diagnostics routes only.

2. **Stored active account**  
   Read `UserActiveAccount` for the user. If present, load membership for that account via `getAccountContextForUserAndAccount(userId, storedAccountId)`. If valid, set `req.user.accountId`, `roleId`, `role`, `permissions` from that context and return. If invalid, clear the stored row and continue.

3. **Fallback**  
   Call `getAccountContextForUser(userId)`: deterministic choice (e.g. default account by slug, else lowest AccountID) among the user’s active account memberships. Set `req.user` from that context.

4. **Superadmin default**  
   If the user has no membership but is a platform superadmin, set `req.user.accountId` to the default account (Slug = `'default'`). Role/permissions are not changed from JWT in this path.

5. **No context**  
   Otherwise respond **403** with “No active account membership”.

All tenant-scoped handlers must use `req.user` (accountId, role, permissions) **after** this middleware, not the raw JWT payload, so that after an account switch the session reflects the new account.

---

## 3. Permission evaluation (AccountMembers + RolePermissions + Permissions)

- **Membership:** `dbo.AccountMembers` links User, Account, Role, and IsActive. Only rows with `IsActive = 1` and account `IsActive = 1` are considered.
- **Role:** For the resolved account, the user’s role is `AccountMembers.RoleID` (e.g. Admin, Engineer). Role name comes from `dbo.Roles`.
- **Permissions:** Loaded from `dbo.RolePermissions` + `dbo.Permissions` for that `RoleID` (permission keys). No account-level permission table; permissions are per role.
- **API checks:** Routes use `requirePermission(permissionKey)` which calls `checkUserPermission(userId, accountId, permissionKey)` (backed by the same membership + role + permissions). The session endpoint `GET /api/backend/auth/session` returns the hydrated `accountId`, `role`, and `permissions` from `req.user` after `attachAccountContext`, so the UI always sees the current account and its permissions.

---

## 4. Superadmin override rules (platform/diagnostics only)

- **Definition:** Superadmin is determined by env (e.g. `SUPERADMIN_USER_IDS`, `SUPERADMIN_EMAILS`), not by a role in the database.
- **Override:** Allowed **only** on routes under `/api/backend/platform/` and `/api/backend/diagnostics/`. On those routes, a superadmin may send `x-specverse-account-id: <id>` to act in that account. Diagnostics: GET only.
- **Normal routes:** No header override; superadmin still gets account context from stored → fallback like any other user. Account-scoped data remains account-scoped.

---

## 5. Common failure modes (401 / 403 / 409)

| Code | Meaning | Typical cause |
|------|--------|----------------|
| **401** | Unauthorized | No token, invalid/expired token, or session endpoint returns “No session” when `req.user` is missing. |
| **403** | Forbidden | No active account membership; permission denied for the current account; or (for override) non-superadmin sending `x-specverse-account-id` or override used on a non-platform/diagnostics route. |
| **409** | Conflict | “No active account selected” — e.g. account-members or other endpoints that require an active account, but the user has not selected one (e.g. no row in UserActiveAccount and fallback didn’t apply, or UI called an endpoint before context was set). UI should prompt to use the account switcher. |

Handlers should use `req.user` (set by `verifyToken` + `attachAccountContext`) so that after switching accounts, the next request (including `GET /api/backend/auth/session`) returns the new accountId, role, and permissions.
