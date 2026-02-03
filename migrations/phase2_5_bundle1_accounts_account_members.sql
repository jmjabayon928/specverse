-- Phase 2.5 Bundle 1: Accounts + AccountMembers (schema foundation only)
-- Contracts: docs/phase2.5-tenant-model-and-table-scope.md, docs/phase2.5-roles-permissions.md
-- Scope: Create Accounts and AccountMembers; seed one default account; backfill memberships for existing users.
-- Does NOT add AccountID to any existing tenant tables (that is Bundle 2).
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.

USE DataSheets;
GO

-- =============================================================================
-- 1. Create Accounts table
-- =============================================================================
IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        AccountID   INT IDENTITY(1,1) NOT NULL,
        AccountName NVARCHAR(255)    NOT NULL,
        Slug       NVARCHAR(64)     NOT NULL,
        IsActive   BIT              NOT NULL DEFAULT 1,
        CreatedAt  DATETIME2(0)     NOT NULL DEFAULT GETDATE(),
        UpdatedAt  DATETIME2(0)     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Accounts PRIMARY KEY (AccountID),
        CONSTRAINT UQ_Accounts_Slug UNIQUE (Slug)
    );
    CREATE NONCLUSTERED INDEX IX_Accounts_IsActive ON dbo.Accounts (IsActive);
    PRINT 'Accounts table created.';
END
ELSE
    PRINT 'Accounts table already exists.';
GO

-- =============================================================================
-- 2. Create AccountMembers table
-- =============================================================================
IF OBJECT_ID(N'dbo.AccountMembers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AccountMembers (
        AccountMemberID INT IDENTITY(1,1) NOT NULL,
        AccountID       INT               NOT NULL,
        UserID          INT               NOT NULL,
        RoleID          INT               NOT NULL,
        IsActive        BIT               NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2(0)      NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2(0)      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_AccountMembers PRIMARY KEY (AccountMemberID),
        CONSTRAINT UQ_AccountMembers_AccountID_UserID UNIQUE (AccountID, UserID),
        CONSTRAINT FK_AccountMembers_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID) ON DELETE CASCADE,
        CONSTRAINT FK_AccountMembers_UserID    FOREIGN KEY (UserID)    REFERENCES dbo.Users(UserID)   ON DELETE CASCADE,
        CONSTRAINT FK_AccountMembers_RoleID    FOREIGN KEY (RoleID)    REFERENCES dbo.Roles(RoleID)
    );
    CREATE NONCLUSTERED INDEX IX_AccountMembers_AccountID_RoleID ON dbo.AccountMembers (AccountID, RoleID);
    CREATE NONCLUSTERED INDEX IX_AccountMembers_UserID ON dbo.AccountMembers (UserID);
    CREATE NONCLUSTERED INDEX IX_AccountMembers_AccountID_IsActive ON dbo.AccountMembers (AccountID, IsActive);
    PRINT 'AccountMembers table created.';
END
ELSE
    PRINT 'AccountMembers table already exists.';
GO

-- =============================================================================
-- 3. Seed default account (idempotent)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Accounts WHERE Slug = N'default')
BEGIN
    INSERT INTO dbo.Accounts (AccountName, Slug, IsActive)
    VALUES (N'Default Account', N'default', 1);
    PRINT 'Default account seeded.';
END
ELSE
    PRINT 'Default account already exists.';
GO

-- =============================================================================
-- 4. Backfill AccountMembers for all existing users (idempotent, deterministic)
--     One row per (AccountID, UserID). RoleID from Users.RoleID when present;
--     when Users.RoleID is null, use Viewer role only. If any user has null RoleID
--     and Viewer role does not exist, migration fails with clear error (seed Roles first).
-- =============================================================================
IF EXISTS (SELECT 1 FROM dbo.Users WHERE RoleID IS NULL)
   AND NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Viewer')
BEGIN
    RAISERROR(
        N'AccountMembers backfill requires a Viewer role when Users.RoleID is NULL. Seed Roles (e.g. run dev seed or add Roles with RoleName = ''Viewer'') and re-run this migration.',
        16,
        1
    );
    RETURN;
END

;WITH DefaultAccount AS (
    SELECT AccountID FROM dbo.Accounts WHERE Slug = N'default'
),
TargetUsers AS (
    SELECT
        u.UserID,
        COALESCE(u.RoleID, (SELECT RoleID FROM dbo.Roles WHERE RoleName = N'Viewer')) AS RoleID
    FROM dbo.Users u
    CROSS JOIN DefaultAccount a
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.AccountMembers am
        WHERE am.AccountID = a.AccountID AND am.UserID = u.UserID
    )
)
INSERT INTO dbo.AccountMembers (AccountID, UserID, RoleID, IsActive, CreatedAt, UpdatedAt)
SELECT a.AccountID, t.UserID, t.RoleID, 1, GETDATE(), GETDATE()
FROM TargetUsers t
CROSS JOIN DefaultAccount a;

IF @@ROWCOUNT > 0
    PRINT 'AccountMembers backfill: one or more rows inserted.';
GO
