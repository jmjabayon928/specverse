-- Migration: Make dbo.SheetRevisions.RevisionID auto-generated via SEQUENCE + DEFAULT
-- Purpose: Fix "Cannot insert the value NULL into column 'RevisionID'" when INSERT omits RevisionID.
-- Dev-safe: Idempotent; does not destroy data. Use SEQUENCE + DEFAULT so existing INSERT (no RevisionID) works.

-- Compute start value: MAX(RevisionID)+1 if table has rows, else 1
DECLARE @startWith BIGINT = 1;
SELECT @startWith = ISNULL(MAX(CAST(RevisionID AS BIGINT)), 0) + 1
FROM dbo.SheetRevisions;

-- Create sequence if missing (dynamic SQL required for START WITH variable)
IF OBJECT_ID('dbo.SheetRevisions_RevisionID_Seq', 'SO') IS NULL
BEGIN
  DECLARE @sql NVARCHAR(500) = N'CREATE SEQUENCE dbo.SheetRevisions_RevisionID_Seq
    AS BIGINT
    START WITH ' + CAST(@startWith AS NVARCHAR(20)) + N'
    INCREMENT BY 1
    NO CACHE;';
  EXEC sp_executesql @sql;
  PRINT 'Created sequence dbo.SheetRevisions_RevisionID_Seq';
END
ELSE
BEGIN
  PRINT 'Sequence dbo.SheetRevisions_RevisionID_Seq already exists.';
END
GO

-- Add default constraint on RevisionID if missing
IF NOT EXISTS (
  SELECT 1
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  JOIN sys.tables t ON t.object_id = c.object_id
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'SheetRevisions' AND c.name = 'RevisionID'
)
BEGIN
  ALTER TABLE dbo.SheetRevisions
  ADD CONSTRAINT DF_SheetRevisions_RevisionID
  DEFAULT (NEXT VALUE FOR dbo.SheetRevisions_RevisionID_Seq) FOR RevisionID;
  PRINT 'Added default constraint DF_SheetRevisions_RevisionID';
END
ELSE
BEGIN
  PRINT 'Default constraint on SheetRevisions.RevisionID already exists.';
END
GO
