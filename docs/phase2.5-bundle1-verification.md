# Phase 2.5 Bundle 1 — Verification

After running `migrations/phase2_5_bundle1_accounts_account_members.sql`, use the following to verify.

**Prerequisite for backfill:** If any row in `Users` has `RoleID` NULL, the migration requires a role with `RoleName = N'Viewer'` to exist. Seed Roles first (e.g. dev seed or add a Viewer role) or the migration will fail with a clear error.

## Verification SQL

Run against the **DataSheets** database:

```sql
-- 1) Default account exists
SELECT * FROM dbo.Accounts WHERE Slug = N'default';

-- 2) AccountMembers count (should be >= number of users)
SELECT COUNT(*) AS MemberCount FROM dbo.AccountMembers;

-- 3) Members per account
SELECT AccountID, COUNT(*) AS MemberCount
FROM dbo.AccountMembers
GROUP BY AccountID;

-- 4) No duplicates on (AccountID, UserID)
SELECT AccountID, UserID, COUNT(*) AS Cnt
FROM dbo.AccountMembers
GROUP BY AccountID, UserID
HAVING COUNT(*) > 1;
-- Expect: no rows.

-- 5) Every user has at least one membership (optional sanity check)
SELECT u.UserID, u.Email
FROM dbo.Users u
LEFT JOIN dbo.AccountMembers am ON am.UserID = u.UserID
WHERE am.AccountMemberID IS NULL;
-- Expect: no rows (after backfill).
```

## Migration verification checklist

- [ ] Roles are seeded (at least a `Viewer` role if any `Users.RoleID` is NULL) before running the migration
- [ ] Forward migration runs without error: `phase2_5_bundle1_accounts_account_members.sql`
- [ ] Table `dbo.Accounts` exists with columns: AccountID, AccountName, Slug, IsActive, CreatedAt, UpdatedAt
- [ ] Table `dbo.AccountMembers` exists with columns: AccountMemberID, AccountID, UserID, RoleID, IsActive, CreatedAt, UpdatedAt
- [ ] One row in `Accounts` with Slug = `default`
- [ ] `SELECT COUNT(*) FROM AccountMembers` >= `SELECT COUNT(*) FROM Users`
- [ ] No duplicate (AccountID, UserID) in AccountMembers (run query 4 above)
- [ ] Login/session still works (app does not use AccountMembers yet; no behavior change)
- [ ] Rollback script runs if needed: `rollback_phase2_5_bundle1_accounts_account_members.sql`

## Test harness note

The repo’s backend tests use a mocked database (`tests/__mocks__/backend-db.ts`). There is no integration test that runs against a real DB for migrations. Rely on the verification SQL and checklist above, or run the migration in a local/dev DB and confirm manually.
