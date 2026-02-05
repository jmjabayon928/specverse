-- Phase 3 Bundle 1: Seed VerificationRecordTypes
-- Scope: Seed dbo.VerificationRecordTypes with at least one ACTIVE row for create flow.
-- Prerequisite: Phase 3 Bundle 0 (VerificationRecords table exists).
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.

USE DataSheets;
GO

-- =============================================================================
-- Seed VerificationRecordTypes with General Verification type
-- =============================================================================
IF OBJECT_ID(N'dbo.VerificationRecordTypes', N'U') IS NULL
BEGIN
    RAISERROR(
        N'Phase 3 Bundle 1: dbo.VerificationRecordTypes does not exist. Create it before running this migration.',
        16,
        1
    );
    RETURN;
END
GO

-- Insert General Verification type if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM dbo.VerificationRecordTypes WHERE VerificationTypeID = 1)
BEGIN
    INSERT INTO dbo.VerificationRecordTypes (
        VerificationTypeID,
        Code,
        Name,
        Status,
        StandardRef,
        DisciplineID,
        Description,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        1,
        N'GEN',
        N'General Verification',
        N'Active',
        NULL,
        NULL,
        NULL,
        sysutcdatetime(),
        sysutcdatetime()
    );
    PRINT 'VerificationRecordTypes: Seeded General Verification (VerificationTypeID=1).';
END
ELSE
    PRINT 'VerificationRecordTypes: General Verification (VerificationTypeID=1) already exists.';
GO

-- =============================================================================
-- Validation (read-only)
-- =============================================================================
PRINT '--- Validation: VerificationRecordTypes count ---';
SELECT COUNT(*) AS VerificationRecordTypesCount
  FROM dbo.VerificationRecordTypes;

PRINT '--- Validation: Active VerificationRecordTypes ---';
SELECT VerificationTypeID, Code, Name, Status
  FROM dbo.VerificationRecordTypes
  WHERE Status = N'Active'
  ORDER BY VerificationTypeID;
