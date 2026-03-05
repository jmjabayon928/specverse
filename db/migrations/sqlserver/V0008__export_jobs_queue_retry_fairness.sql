-- V0008: Export job queue retry and fairness (NextAttemptAt, MaxAttempts, LastErrorAt, index).
-- Idempotent; safe to re-run.

SET NOCOUNT ON
GO

/* =========================================================
   dbo.ExportJobs — add retry/scheduling columns (if missing)
   ========================================================= */

IF COL_LENGTH(N'dbo.ExportJobs', N'NextAttemptAt') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD NextAttemptAt DATETIME2(7) NULL
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'MaxAttempts') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD MaxAttempts INT NOT NULL CONSTRAINT DF_ExportJobs_MaxAttempts DEFAULT (3)
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'LastErrorAt') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD LastErrorAt DATETIME2(7) NULL
END
GO

/* =========================================================
   Index for claim-next and fairness (Status, NextAttemptAt, CreatedAt) INCLUDE (AccountID)
   ========================================================= */

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_ExportJobs_Status_NextAttemptAt_CreatedAt' AND object_id = OBJECT_ID(N'dbo.ExportJobs')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_ExportJobs_Status_NextAttemptAt_CreatedAt
  ON dbo.ExportJobs (Status, NextAttemptAt, CreatedAt)
  INCLUDE (AccountID)
END
GO
