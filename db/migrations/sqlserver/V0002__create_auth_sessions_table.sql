/* V0002__create_auth_sessions_table.sql
   Creates dbo.AuthSessions for opaque sid sessions (sid hash stored, not sid).
*/

IF OBJECT_ID(N'dbo.AuthSessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuthSessions (
    AuthSessionID BIGINT IDENTITY(1,1) NOT NULL,
    SidHash VARBINARY(32) NOT NULL,          -- SHA-256(sid)
    UserID INT NOT NULL,
    AccountID INT NULL,
    ExpiresAt DATETIME2(3) NOT NULL,
    RevokedAt DATETIME2(3) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AuthSessions_CreatedAt DEFAULT (SYSUTCDATETIME()),
    LastSeenAt DATETIME2(3) NULL,
    UserAgent NVARCHAR(512) NULL,
    IpAddress NVARCHAR(64) NULL,

    CONSTRAINT PK_AuthSessions PRIMARY KEY CLUSTERED (AuthSessionID),
    CONSTRAINT UQ_AuthSessions_SidHash UNIQUE (SidHash)
  )

  -- Optional FKs (enable only if you want strict enforcement)
  -- ALTER TABLE dbo.AuthSessions WITH CHECK
  --   ADD CONSTRAINT FK_AuthSessions_Users
  --     FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)

  -- ALTER TABLE dbo.AuthSessions WITH CHECK
  --   ADD CONSTRAINT FK_AuthSessions_Accounts
  --     FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID)
END
GO

-- Index to find active session quickly (sid hash lookup already covered by unique)
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.AuthSessions')
    AND name = N'IX_AuthSessions_UserID_ExpiresAt'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_AuthSessions_UserID_ExpiresAt
  ON dbo.AuthSessions (UserID, ExpiresAt)
  INCLUDE (AccountID, RevokedAt, LastSeenAt)
END
GO

-- Optional: fast cleanup queries by ExpiresAt/RevokedAt
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.AuthSessions')
    AND name = N'IX_AuthSessions_ExpiresAt_RevokedAt'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_AuthSessions_ExpiresAt_RevokedAt
  ON dbo.AuthSessions (ExpiresAt, RevokedAt)
END
GO