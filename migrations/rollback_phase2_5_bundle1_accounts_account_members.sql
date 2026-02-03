-- Rollback: Phase 2.5 Bundle 1 (Accounts + AccountMembers)
-- Run only when you need to undo phase2_5_bundle1_accounts_account_members.sql.
-- Order: drop AccountMembers first (has FKs to Accounts and Users), then Accounts.

USE DataSheets;
GO

IF OBJECT_ID(N'dbo.AccountMembers', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.AccountMembers;
    PRINT 'AccountMembers table dropped.';
END
GO

IF OBJECT_ID(N'dbo.Accounts', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Accounts;
    PRINT 'Accounts table dropped.';
END
GO
