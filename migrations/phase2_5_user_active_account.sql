-- Phase 2.5: UserActiveAccount — persisted active account per user
-- Prerequisite: phase2_5_bundle1_accounts_account_members.sql (Accounts, AccountMembers)
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.

USE DataSheets;
GO

IF OBJECT_ID(N'dbo.UserActiveAccount', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserActiveAccount (
        UserID    INT          NOT NULL,
        AccountID INT          NOT NULL,
        UpdatedAt DATETIME2(0)  NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_UserActiveAccount PRIMARY KEY (UserID),
        CONSTRAINT FK_UserActiveAccount_UserID    FOREIGN KEY (UserID)    REFERENCES dbo.Users(UserID)    ON DELETE CASCADE,
        CONSTRAINT FK_UserActiveAccount_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_UserActiveAccount_AccountID ON dbo.UserActiveAccount (AccountID);
    PRINT 'UserActiveAccount table created.';
END
ELSE
    PRINT 'UserActiveAccount table already exists.';
GO
