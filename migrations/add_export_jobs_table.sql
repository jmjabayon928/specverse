-- Migration: Add ExportJobs table for async export jobs (pilot: Inventory Transactions CSV)
-- Created: 2026-01-29
-- Purpose: Store job metadata for long-running exports; files stored on disk with 24h TTL

USE DataSheets;
GO

-- Create ExportJobs table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.ExportJobs') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.ExportJobs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        JobType NVARCHAR(50) NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        Progress INT NOT NULL DEFAULT 0,
        ParamsJson NVARCHAR(MAX) NULL,
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,
        ExpiresAt DATETIME2 NULL,
        ErrorMessage NVARCHAR(1000) NULL,
        FileName NVARCHAR(255) NULL,
        FilePath NVARCHAR(500) NULL,
        CONSTRAINT FK_ExportJobs_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID)
    );

    PRINT 'ExportJobs table created successfully.';
END
ELSE
BEGIN
    PRINT 'ExportJobs table already exists.';
END
GO

-- Index for listing jobs by user (idempotent)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ExportJobs')
      AND name = N'IX_ExportJobs_CreatedBy_CreatedAt'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ExportJobs_CreatedBy_CreatedAt
    ON dbo.ExportJobs (CreatedBy, CreatedAt DESC);
    PRINT 'IX_ExportJobs_CreatedBy_CreatedAt created.';
END
ELSE
    PRINT 'IX_ExportJobs_CreatedBy_CreatedAt already exists.';
GO

-- Index for cleanup (expired / completed)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ExportJobs')
      AND name = N'IX_ExportJobs_Status_ExpiresAt'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ExportJobs_Status_ExpiresAt
    ON dbo.ExportJobs (Status, ExpiresAt);
    PRINT 'IX_ExportJobs_Status_ExpiresAt created.';
END
ELSE
    PRINT 'IX_ExportJobs_Status_ExpiresAt already exists.';
GO
