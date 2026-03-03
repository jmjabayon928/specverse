-- V0003: Uniqueness for CustomFieldDefinitions (tenant rows) and JobStatus CHECK for ImportJobs.
-- Safe to re-run: uses existence checks.

-- A) Unique filtered index for tenant definitions
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_CustomFieldDefinitions_Account_Entity_FieldKey'
    AND object_id = OBJECT_ID('dbo.CustomFieldDefinitions')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_CustomFieldDefinitions_Account_Entity_FieldKey
  ON dbo.CustomFieldDefinitions (AccountID, EntityType, FieldKey)
  WHERE AccountID IS NOT NULL;
END
GO

-- B) CHECK constraint on ImportJobs.JobStatus
IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_ImportJobs_JobStatus'
    AND parent_object_id = OBJECT_ID('dbo.ImportJobs')
)
BEGIN
  ALTER TABLE dbo.ImportJobs WITH CHECK
  ADD CONSTRAINT CK_ImportJobs_JobStatus
  CHECK (JobStatus IN (N'preview_created', N'preview_complete', N'running', N'succeeded', N'failed'));
END
GO
