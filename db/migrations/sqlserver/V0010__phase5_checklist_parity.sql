-- Phase 5 Checklist Parity Migration
-- Adds template versioning and run lifecycle support

-- Add VersionNumber and Status to ChecklistTemplates
IF COL_LENGTH('dbo.ChecklistTemplates', 'VersionNumber') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistTemplates
  ADD VersionNumber INT NOT NULL DEFAULT 1;
END

IF COL_LENGTH('dbo.ChecklistTemplates', 'Status') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistTemplates
  ADD Status NVARCHAR(16) NOT NULL DEFAULT 'DRAFT';
END

-- Add ChecklistTemplateVersionNumber, UpdatedAt, CompletedAt to ChecklistRuns
IF COL_LENGTH('dbo.ChecklistRuns', 'ChecklistTemplateVersionNumber') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistRuns
  ADD ChecklistTemplateVersionNumber INT NULL;
END

IF COL_LENGTH('dbo.ChecklistRuns', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistRuns
  ADD UpdatedAt DATETIME2(0) NULL;
END

IF COL_LENGTH('dbo.ChecklistRuns', 'CompletedAt') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistRuns
  ADD CompletedAt DATETIME2(0) NULL;
END

-- Backfill UpdatedAt = CreatedAt for existing rows
IF COL_LENGTH('dbo.ChecklistRuns', 'UpdatedAt') IS NOT NULL
BEGIN
  UPDATE dbo.ChecklistRuns
  SET UpdatedAt = CreatedAt
  WHERE UpdatedAt IS NULL;
END

-- Backfill Status = 'DRAFT' for existing rows (including invalid values)
IF COL_LENGTH('dbo.ChecklistRuns', 'Status') IS NOT NULL
BEGIN
  UPDATE dbo.ChecklistRuns
  SET Status = 'DRAFT'
  WHERE Status IS NULL
     OR Status = ''
     OR Status NOT IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
END

-- Backfill Status = 'DRAFT' for existing templates (including invalid values)
IF COL_LENGTH('dbo.ChecklistTemplates', 'Status') IS NOT NULL
BEGIN
  UPDATE dbo.ChecklistTemplates
  SET Status = 'DRAFT'
  WHERE Status IS NULL
     OR Status = ''
     OR Status NOT IN ('DRAFT', 'PUBLISHED', 'ARCHIVED');
END

-- Add CHECK constraint for valid Status values
IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_ChecklistRuns_Status'
)
BEGIN
  ALTER TABLE dbo.ChecklistRuns
  ADD CONSTRAINT CK_ChecklistRuns_Status
  CHECK (Status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
END

-- Create index for template status lookups
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_ChecklistTemplates_AccountID_Status'
)
BEGIN
  CREATE INDEX IX_ChecklistTemplates_AccountID_Status
  ON dbo.ChecklistTemplates(AccountID, Status);
END