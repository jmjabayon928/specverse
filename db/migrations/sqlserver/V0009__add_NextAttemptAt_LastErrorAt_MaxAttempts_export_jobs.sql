/* 
  Migration: Add NextAttemptAt + LastErrorAt + MaxAttempts to ExportJobs and create indexes
  Purpose: Support export job retry scheduling, polling performance, and error diagnostics
  Safe to run multiple times (idempotent)
*/

SET NOCOUNT ON

------------------------------------------------------------
-- 1. Add NextAttemptAt column if missing
------------------------------------------------------------
IF COL_LENGTH('dbo.ExportJobs', 'NextAttemptAt') IS NULL
BEGIN
  PRINT 'Adding column dbo.ExportJobs.NextAttemptAt'
  ALTER TABLE dbo.ExportJobs
  ADD NextAttemptAt datetime2(7) NULL
END
ELSE
BEGIN
  PRINT 'Column dbo.ExportJobs.NextAttemptAt already exists'
END

------------------------------------------------------------
-- 2. Add LastErrorAt column if missing
------------------------------------------------------------
IF COL_LENGTH('dbo.ExportJobs', 'LastErrorAt') IS NULL
BEGIN
  PRINT 'Adding column dbo.ExportJobs.LastErrorAt'
  ALTER TABLE dbo.ExportJobs
  ADD LastErrorAt datetime2(7) NULL
END
ELSE
BEGIN
  PRINT 'Column dbo.ExportJobs.LastErrorAt already exists'
END

------------------------------------------------------------
-- 3. Add MaxAttempts column if missing
-- Default chosen to be safe: 3 retries unless the app overrides per job.
------------------------------------------------------------
IF COL_LENGTH('dbo.ExportJobs', 'MaxAttempts') IS NULL
BEGIN
  PRINT 'Adding column dbo.ExportJobs.MaxAttempts (default 3)'
  ALTER TABLE dbo.ExportJobs
  ADD MaxAttempts int NOT NULL
    CONSTRAINT DF_ExportJobs_MaxAttempts DEFAULT ((3))

  -- Optional: backfill is implicit because NOT NULL + DEFAULT
END
ELSE
BEGIN
  PRINT 'Column dbo.ExportJobs.MaxAttempts already exists'
END

------------------------------------------------------------
-- 4. Create polling index if missing
-- Runner typically filters by Status + due time + lease window, and may also check attempts remaining.
------------------------------------------------------------
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_ExportJobs_Poll'
    AND object_id = OBJECT_ID('dbo.ExportJobs')
)
BEGIN
  PRINT 'Creating index IX_ExportJobs_Poll'
  CREATE NONCLUSTERED INDEX IX_ExportJobs_Poll
  ON dbo.ExportJobs (Status, NextAttemptAt, LeasedUntil)
  INCLUDE (AccountID, AttemptCount, MaxAttempts, CreatedAt)
END
ELSE
BEGIN
  PRINT 'Index IX_ExportJobs_Poll already exists'
END

------------------------------------------------------------
-- 5. Create supporting index for operational queries (recent failures)
------------------------------------------------------------
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_ExportJobs_LastErrorAt'
    AND object_id = OBJECT_ID('dbo.ExportJobs')
)
BEGIN
  PRINT 'Creating index IX_ExportJobs_LastErrorAt'
  CREATE NONCLUSTERED INDEX IX_ExportJobs_LastErrorAt
  ON dbo.ExportJobs (LastErrorAt DESC)
  INCLUDE (Id, AccountID, Status, AttemptCount, MaxAttempts, NextAttemptAt, CreatedAt)
END
ELSE
BEGIN
  PRINT 'Index IX_ExportJobs_LastErrorAt already exists'
END