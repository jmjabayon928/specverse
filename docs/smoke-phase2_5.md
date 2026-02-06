# Phase 2.5 — Smoke checklist

Manual steps to verify account switching and account members management. Use after deployment or before a demo.

---

## Prerequisites

- Backend and frontend running; DB migrations applied (including `UserActiveAccount`, `Accounts`, `AccountMembers`).
- At least two accounts and a user with membership in both (e.g. different roles per account).

---

## 1. Account switcher

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Log in and open the app (any page with the header). | Header shows the account switcher (current account name or “Select an account” / “No account”). |
| 1.2 | Click the account switcher. | Dropdown lists all accounts the user belongs to, with role per account. |
| 1.3 | Select a different account. | Dropdown closes; page refreshes or updates; header shows the new account name. |
| 1.4 | Call `GET /api/backend/auth/session` with the same cookie (e.g. from DevTools or Postman). | Response includes `accountId`, `role`, and `permissions` for the **new** account (not the previous one). |
| 1.5 | Navigate to a feature that uses permissions (e.g. Settings → Members). | UI and API reflect the new account (e.g. members list for that account; role/status controls only if user has ACCOUNT_ROLE_MANAGE / ACCOUNT_USER_MANAGE). |

**Failure cases**

- **409 “No active account selected”** on members or other endpoints → User has no stored active account and no valid fallback; use the account switcher to pick an account.
- **403 “You don’t have permission”** → User lacks the required permission in the current account.

---

## 2. Members page (role and status)

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | As a user with **ACCOUNT_VIEW**, go to **Settings → Members**. | Members page loads; table shows members of the **current** account (name/email, role, status). |
| 2.2 | Without ACCOUNT_ROLE_MANAGE / ACCOUNT_USER_MANAGE | Role dropdown and Active/Inactive toggle are **disabled**. |
| 2.3 | As a user with **ACCOUNT_ROLE_MANAGE** (and VIEW), change a member’s role via the dropdown. | PATCH succeeds; table updates; success toast. |
| 2.4 | As a user with **ACCOUNT_USER_MANAGE** (and VIEW), click the status button to deactivate a member. | PATCH succeeds; row shows “Inactive”; success toast. |
| 2.5 | Reactivate the same member. | PATCH succeeds; row shows “Active”. |
| 2.6 | Trigger a failure (e.g. demote last admin, or use invalid ID). | Error toast: 403 “You don’t have permission” or server message. |

---

## 3. SQL snippets to confirm state

**UserActiveAccount (current selection per user)**

```sql
SELECT UserID, AccountID, UpdatedAt
FROM dbo.UserActiveAccount
ORDER BY UserID;
```

**Account members (and roles) for an account**

```sql
SELECT am.UserID, am.AccountID, am.RoleID, r.RoleName, am.IsActive, am.CreatedAt, am.UpdatedAt
FROM dbo.AccountMembers am
INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
WHERE am.AccountID = 1  -- replace with your account
ORDER BY am.UserID;
```

**Permissions for a role**

```sql
SELECT r.RoleID, r.RoleName, p.PermissionKey
FROM dbo.RolePermissions rp
INNER JOIN dbo.Roles r ON r.RoleID = rp.RoleID
INNER JOIN dbo.Permissions p ON p.PermissionID = rp.PermissionID
WHERE r.RoleID = 1  -- replace with your role
ORDER BY p.PermissionKey;
```

Use these to confirm that after switching accounts, `UserActiveAccount` has the new `AccountID`, and that the members/permissions you see in the UI match the DB for that account.
