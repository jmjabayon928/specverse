-- Migration: Add SnapshotJson, CreatedByID, CreatedByDate to SheetRevisions (align with forward-looking schema)
-- Purpose: Support full snapshot storage for restore/diff; track who created the revision and when.
-- Dev-safe: ADD columns as NULL so existing rows are unaffected.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SheetRevisions' AND COLUMN_NAME = 'SnapshotJson'
)
BEGIN
  ALTER TABLE dbo.SheetRevisions
  ADD SnapshotJson NVARCHAR(MAX) NULL;
  PRINT 'Added SheetRevisions.SnapshotJson';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SheetRevisions' AND COLUMN_NAME = 'CreatedByID'
)
BEGIN
  ALTER TABLE dbo.SheetRevisions
  ADD CreatedByID INT NULL;
  PRINT 'Added SheetRevisions.CreatedByID';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SheetRevisions' AND COLUMN_NAME = 'CreatedByDate'
)
BEGIN
  ALTER TABLE dbo.SheetRevisions
  ADD CreatedByDate DATETIME2(0) NULL;
  PRINT 'Added SheetRevisions.CreatedByDate';
END
GO
