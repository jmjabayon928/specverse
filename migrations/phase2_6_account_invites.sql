-- Phase 2.6: AccountInvites — email-based invites with token (stored as hash), status, resend/revoke/accept/decline
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.
-- Prerequisite: phase2_5_bundle1_accounts_account_members.sql (Accounts, AccountMembers, Roles, Users)

USE DataSheets;
GO

IF OBJECT_ID(N'dbo.AccountInvites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AccountInvites (
        InviteID         INT IDENTITY(1,1) NOT NULL,
        AccountID        INT               NOT NULL,
        Email            NVARCHAR(255)     NOT NULL,
        RoleID           INT               NOT NULL,
        TokenHash        CHAR(64)          NOT NULL,
        Status           NVARCHAR(20)      NOT NULL DEFAULT N'Pending',
        ExpiresAt        DATETIME2(0)      NOT NULL,
        InvitedByUserID  INT               NOT NULL,
        CreatedAt        DATETIME2(0)      NOT NULL DEFAULT GETDATE(),
        UpdatedAt        DATETIME2(0)      NOT NULL DEFAULT GETDATE(),
        AcceptedByUserID INT               NULL,
        AcceptedAt       DATETIME2(0)      NULL,
        RevokedByUserID  INT               NULL,
        RevokedAt        DATETIME2(0)      NULL,
        SendCount        INT               NOT NULL DEFAULT 1,
        LastSentAt       DATETIME2(0)      NULL,
        CONSTRAINT PK_AccountInvites PRIMARY KEY (InviteID),
        CONSTRAINT FK_AccountInvites_AccountID       FOREIGN KEY (AccountID)       REFERENCES dbo.Accounts(AccountID) ON DELETE CASCADE,
        CONSTRAINT FK_AccountInvites_RoleID         FOREIGN KEY (RoleID)          REFERENCES dbo.Roles(RoleID),
        CONSTRAINT FK_AccountInvites_InvitedByUserID FOREIGN KEY (InvitedByUserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_AccountInvites_AcceptedByUserID FOREIGN KEY (AcceptedByUserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_AccountInvites_RevokedByUserID FOREIGN KEY (RevokedByUserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT CK_AccountInvites_Status CHECK (Status IN (N'Pending', N'Accepted', N'Revoked', N'Declined', N'Expired'))
    );
    CREATE NONCLUSTERED INDEX IX_AccountInvites_TokenHash ON dbo.AccountInvites (TokenHash);
    CREATE UNIQUE NONCLUSTERED INDEX IX_AccountInvites_AccountID_Email_Pending
        ON dbo.AccountInvites (AccountID, Email)
        WHERE Status = N'Pending';
    CREATE NONCLUSTERED INDEX IX_AccountInvites_AccountID_Status ON dbo.AccountInvites (AccountID, Status);
    PRINT 'AccountInvites table created.';
END
ELSE
    PRINT 'AccountInvites table already exists.';
GO
