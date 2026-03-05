-- V0007 (export jobs): Export job leases and ExportJobItems (idempotent).
-- Safe to re-run: uses existence checks.

SET NOCOUNT ON
GO

/* =========================================================
   1) dbo.ExportJobs — add lease columns and constraints (if missing)
   ========================================================= */

IF COL_LENGTH(N'dbo.ExportJobs', N'LeaseId') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD LeaseId UNIQUEIDENTIFIER NULL
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'LeasedUntil') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD LeasedUntil DATETIME2(7) NULL
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'AttemptCount') IS NULL
BEGIN
  ALTER TABLE dbo.ExportJobs ADD AttemptCount INT NOT NULL CONSTRAINT DF_ExportJobs_AttemptCount DEFAULT (0)
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'CK_ExportJobs_Status' AND parent_object_id = OBJECT_ID(N'dbo.ExportJobs')
)
BEGIN
  ALTER TABLE dbo.ExportJobs WITH CHECK
  ADD CONSTRAINT CK_ExportJobs_Status
  CHECK (Status IN (N'queued', N'running', N'completed', N'failed', N'cancelled'))
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'CK_ExportJobs_Progress' AND parent_object_id = OBJECT_ID(N'dbo.ExportJobs')
)
BEGIN
  ALTER TABLE dbo.ExportJobs WITH CHECK
  ADD CONSTRAINT CK_ExportJobs_Progress
  CHECK (Progress >= 0 AND Progress <= 100)
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_ExportJobs_Status_LeasedUntil_CreatedAt' AND object_id = OBJECT_ID(N'dbo.ExportJobs')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_ExportJobs_Status_LeasedUntil_CreatedAt
  ON dbo.ExportJobs (Status, LeasedUntil, CreatedAt)
END
GO

/* =========================================================
   2) dbo.ExportJobItems — create if missing
   ========================================================= */

IF OBJECT_ID(N'dbo.ExportJobItems', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ExportJobItems (
    ExportJobItemId INT IDENTITY(1,1) NOT NULL,
    JobId INT NOT NULL,
    RelativePath NVARCHAR(1000) NOT NULL,
    RelativePathHash VARBINARY(32) NOT NULL,
    SourceType NVARCHAR(40) NOT NULL,
    SourceId INT NULL,
    ItemStatus NVARCHAR(40) NOT NULL CONSTRAINT DF_ExportJobItems_ItemStatus DEFAULT (N'queued'),
    ErrorMessage NVARCHAR(2000) NULL,
    ByteSize BIGINT NULL,
    CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ExportJobItems_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_ExportJobItems PRIMARY KEY CLUSTERED (ExportJobItemId),
    CONSTRAINT FK_ExportJobItems_JobId FOREIGN KEY (JobId) REFERENCES dbo.ExportJobs(Id) ON DELETE CASCADE
  )

  CREATE UNIQUE NONCLUSTERED INDEX UX_ExportJobItems_JobId_RelativePathHash
  ON dbo.ExportJobItems (JobId, RelativePathHash)

  CREATE NONCLUSTERED INDEX IX_ExportJobItems_JobId_ItemStatus
  ON dbo.ExportJobItems (JobId, ItemStatus)
END
GO
