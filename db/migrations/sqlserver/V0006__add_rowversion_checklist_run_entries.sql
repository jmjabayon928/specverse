IF COL_LENGTH('dbo.ChecklistRunEntries', 'RowVersion') IS NULL
BEGIN
  ALTER TABLE dbo.ChecklistRunEntries
  ADD RowVersion rowversion NOT NULL;
END