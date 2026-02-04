-- Phase 3 Bundle 0: VerificationRecords multi-account safe + linkable
-- Scope: Add AccountID to VerificationRecords, backfill from default account,
--        create VerificationRecordLinks (link to Sheets) and VerificationRecordAttachments (link to Attachments).
-- Prerequisite: Phase 2.5 Bundle 1 (Accounts, default account) and Bundle 2 (tenant model) applied.
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.

USE DataSheets;
GO

-- =============================================================================
-- A. Add AccountID to VerificationRecords (if missing)
-- =============================================================================
IF OBJECT_ID(N'dbo.VerificationRecords', N'U') IS NULL
BEGIN
    RAISERROR(
        N'Phase 3 Bundle 0: dbo.VerificationRecords does not exist. Create it before running this migration.',
        16,
        1
    );
    RETURN;
END

IF COL_LENGTH(N'dbo.VerificationRecords', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.VerificationRecords ADD AccountID INT NULL;
    PRINT 'dbo.VerificationRecords: AccountID column added.';
END
ELSE
    PRINT 'dbo.VerificationRecords: AccountID already present.';
GO

-- =============================================================================
-- B. Backfill AccountID from default account; fail fast if default missing
-- =============================================================================
DECLARE @DefaultAccountID INT;
SELECT TOP 1 @DefaultAccountID = AccountID FROM dbo.Accounts WHERE Slug = N'default';

IF @DefaultAccountID IS NULL
BEGIN
    RAISERROR(
        N'Phase 3 Bundle 0 backfill: Default account (Slug = ''default'') not found. Run Phase 2.5 Bundle 1 seed first.',
        16,
        1
    );
    RETURN;
END

IF COL_LENGTH(N'dbo.VerificationRecords', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.VerificationRecords SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.VerificationRecords: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
GO

-- =============================================================================
-- C. Alter AccountID to NOT NULL (only if column exists and still nullable)
-- =============================================================================
IF COL_LENGTH(N'dbo.VerificationRecords', N'AccountID') IS NOT NULL
   AND (SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.VerificationRecords') AND name = N'AccountID') = 1
BEGIN
    ALTER TABLE dbo.VerificationRecords ALTER COLUMN AccountID INT NOT NULL;
    PRINT 'dbo.VerificationRecords: AccountID set to NOT NULL.';
END
GO

-- =============================================================================
-- D. Add FK VerificationRecords.AccountID -> Accounts(AccountID)
-- =============================================================================
IF COL_LENGTH(N'dbo.VerificationRecords', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.VerificationRecords') AND name = N'FK_VerificationRecords_AccountID')
BEGIN
    ALTER TABLE dbo.VerificationRecords ADD CONSTRAINT FK_VerificationRecords_AccountID
        FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_VerificationRecords_AccountID added.';
END
GO

-- =============================================================================
-- E. Create dbo.VerificationRecordLinks if missing
--    Links verification records to Sheets (and future link types). Tenant consistency:
--    VerificationRecordLinks.AccountID must match VerificationRecords.AccountID;
--    enforced by trigger (SQL Server cannot express this as a simple FK across two tables).
-- =============================================================================
IF OBJECT_ID(N'dbo.VerificationRecordLinks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VerificationRecordLinks (
        VerificationRecordLinkID INT IDENTITY(1,1) NOT NULL,
        AccountID                INT                NOT NULL,
        VerificationRecordID     INT                NOT NULL,
        SheetID                  INT                NULL,
        CONSTRAINT PK_VerificationRecordLinks PRIMARY KEY (VerificationRecordLinkID),
        CONSTRAINT FK_VerificationRecordLinks_AccountID            FOREIGN KEY (AccountID)            REFERENCES dbo.Accounts(AccountID),
        CONSTRAINT FK_VerificationRecordLinks_VerificationRecordID FOREIGN KEY (VerificationRecordID) REFERENCES dbo.VerificationRecords(VerificationRecordID),
        CONSTRAINT FK_VerificationRecordLinks_SheetID             FOREIGN KEY (SheetID)             REFERENCES dbo.Sheets(SheetID)
    );
    CREATE NONCLUSTERED INDEX IX_VerificationRecordLinks_AccountID ON dbo.VerificationRecordLinks (AccountID);
    CREATE NONCLUSTERED INDEX IX_VerificationRecordLinks_VerificationRecordID ON dbo.VerificationRecordLinks (VerificationRecordID);
    CREATE NONCLUSTERED INDEX IX_VerificationRecordLinks_SheetID ON dbo.VerificationRecordLinks (SheetID);
    PRINT 'dbo.VerificationRecordLinks created.';
END
ELSE
    PRINT 'dbo.VerificationRecordLinks already exists.';
GO

-- Trigger: ensure VerificationRecordLinks.AccountID matches VerificationRecords.AccountID (tenant consistency)
IF OBJECT_ID(N'dbo.tr_VerificationRecordLinks_AccountID_Consistency', N'TR') IS NULL
   AND OBJECT_ID(N'dbo.VerificationRecordLinks', N'U') IS NOT NULL
BEGIN
    EXEC (N'
    CREATE TRIGGER dbo.tr_VerificationRecordLinks_AccountID_Consistency
    ON dbo.VerificationRecordLinks
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN dbo.VerificationRecords vr ON vr.VerificationRecordID = i.VerificationRecordID
            WHERE vr.AccountID <> i.AccountID
        )
        BEGIN
            RAISERROR(N''VerificationRecordLinks.AccountID must match VerificationRecords.AccountID for the linked record.'', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END
    END
    ');
    PRINT 'Trigger tr_VerificationRecordLinks_AccountID_Consistency created.';
END
GO

-- =============================================================================
-- F. Create dbo.VerificationRecordAttachments if missing
--    Joins verification records to existing dbo.Attachments (evidence files).
--    If dbo.Attachments does not exist, we fail fast with a clear message.
-- =============================================================================
IF OBJECT_ID(N'dbo.Attachments', N'U') IS NULL
BEGIN
    RAISERROR(
        N'Phase 3 Bundle 0: dbo.Attachments does not exist. VerificationRecordAttachments requires it. Create Attachments first or add a TODO and skip this table.',
        16,
        1
    );
    RETURN;
END

IF OBJECT_ID(N'dbo.VerificationRecordAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VerificationRecordAttachments (
        VerificationRecordID INT NOT NULL,
        AttachmentID        INT NOT NULL,
        CONSTRAINT PK_VerificationRecordAttachments PRIMARY KEY (VerificationRecordID, AttachmentID),
        CONSTRAINT FK_VerificationRecordAttachments_VerificationRecordID FOREIGN KEY (VerificationRecordID) REFERENCES dbo.VerificationRecords(VerificationRecordID),
        CONSTRAINT FK_VerificationRecordAttachments_AttachmentID        FOREIGN KEY (AttachmentID)        REFERENCES dbo.Attachments(AttachmentID)
    );
    CREATE NONCLUSTERED INDEX IX_VerificationRecordAttachments_AttachmentID ON dbo.VerificationRecordAttachments (AttachmentID);
    PRINT 'dbo.VerificationRecordAttachments created.';
END
ELSE
    PRINT 'dbo.VerificationRecordAttachments already exists.';
GO

-- =============================================================================
-- Validation (read-only)
-- No schema changes below. Run to confirm migration state.
-- =============================================================================
GO

PRINT '--- Validation: VerificationRecords with NULL AccountID (must be 0) ---';
SELECT COUNT(*) AS VerificationRecordsWithNullAccountID
  FROM dbo.VerificationRecords
  WHERE AccountID IS NULL;

PRINT '--- Validation: Top 5 verification records with AccountID ---';
SELECT TOP 5 VerificationRecordID, AccountID, IssuedAt, Issuer, Type
  FROM dbo.VerificationRecords
  ORDER BY VerificationRecordID;

PRINT '--- Validation: New tables exist ---';
SELECT name AS TableName
  FROM sys.tables
  WHERE name IN (N'VerificationRecordLinks', N'VerificationRecordAttachments');

PRINT '--- Validation: FKs on VerificationRecords / VerificationRecordLinks / VerificationRecordAttachments ---';
SELECT fk.name AS FKName,
       OBJECT_NAME(fk.parent_object_id) AS [Table],
       OBJECT_NAME(fk.referenced_object_id) AS [References]
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) IN (N'VerificationRecords', N'VerificationRecordLinks', N'VerificationRecordAttachments')
  ORDER BY [Table], fk.name;
